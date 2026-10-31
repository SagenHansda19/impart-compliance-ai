import pytest

from app.model_client import MockModel, ModelCallError

CR = "Add a new timestamp field to the trade report with millisecond precision."
A = "/api/assessments"


def code(r):
    return r.json()["error"]["code"]


# ---------- text input validation ----------
@pytest.mark.parametrize("body,status,c", [
    ({}, 422, "cr_missing"),
    ({"cr_text": None}, 422, "cr_missing"),
    ({"cr_text": ""}, 422, "cr_blank"),
    ({"cr_text": "   \n\t "}, 422, "cr_blank"),
    ({"cr_text": 123}, 422, "cr_invalid_type"),
    ({"cr_text": ["a"]}, 422, "cr_invalid_type"),
    ({"cr_text": "short"}, 422, "cr_too_short"),
    ({"cr_text": "x" * 10001}, 413, "cr_too_long"),
    ({"cr_text": "Contact john.doe@bank.com about the new timestamp field"}, 422, "pii_detected"),
])
def test_text_validation(client, body, status, c):
    r = client.post(A, json=body)
    assert r.status_code == status and code(r) == c
    assert "request_id" in r.json()
    assert client.get(A).json()["total"] == 0  # nothing reached the model / DB


def test_invalid_json_body(client):
    r = client.post(A, content="{nope", headers={"content-type": "application/json"})
    assert r.status_code == 422 and code(r) == "invalid_request"


def test_symbols_only_is_not_text(client):
    r = client.post(A, json={"cr_text": "!!!!!!!!!!!!!!!!"})
    assert r.status_code == 422


# ---------- happy path + decision ----------
def test_submit_ok_and_shape(client):
    r = client.post(A, json={"cr_text": "Add a plain new label field to the report"})
    assert r.status_code == 201
    d = r.json()
    assert d["overall_conclusion"] == "Proceed" and d["risk_score"] == 0 and d["status"] == "assessed"
    assert d["disclaimer"] == "AI-generated: Requires Human Review"
    assert len(d["compliance_table"]) == 5
    assert {x["region"] for x in d["compliance_table"]} == {"EMEA", "APAC"}
    assert r.headers["X-Request-ID"]
    g = client.get(f"{A}/{d['id']}").json()
    assert g["compliance_table"] == d["compliance_table"] and g["change_request"]["text"].startswith("Add a plain")


def test_non_compliant(client):
    d = client.post(A, json={"cr_text": CR}).json()
    assert d["overall_conclusion"] == "Do Not Proceed" and d["risk_score"] == 40.0
    st = {x["regulation"]: x["effective_status"] for x in d["compliance_table"]}
    assert st["EMIR"] == "non_compliant" and st["MAS"] == "compliant"


def out(**over):
    o = MockModel().call(CR + " x")
    o.update(over)
    return o


def test_unverified_quote_downgrades_yes(client, fake_model):
    o = out()
    o["compliance_table"][2]["quote_verified"] = False
    o["compliance_table"][0]["compliant"] = o["compliance_table"][1]["compliant"] = "Yes"
    fake_model(o)
    d = client.post(A, json={"cr_text": CR}).json()
    asic = [x for x in d["compliance_table"] if x["regulation"] == "ASIC"][0]
    assert asic["effective_status"] == "needs_review" and "unverified_quote" in asic["flags"]
    assert d["overall_conclusion"] == "Needs Review"


def test_sources_disagree_and_unrecognised(client, fake_model):
    o = out()
    for r in o["compliance_table"]:
        r["compliant"] = "Yes"
    o["compliance_table"][0]["sources_disagree"] = True
    o["compliance_table"][1]["compliant"] = "Maybe"
    fake_model(o)
    d = client.post(A, json={"cr_text": CR}).json()
    s = {x["regulation"]: x for x in d["compliance_table"]}
    assert s["EMIR"]["effective_status"] == "needs_review"
    assert s["UKEMIR"]["effective_status"] == "needs_review" and "unrecognised_verdict" in s["UKEMIR"]["flags"]


def test_missing_regulation_warns(client, fake_model):
    o = out(); o["compliance_table"] = o["compliance_table"][:3]
    for r in o["compliance_table"]:
        r["compliant"] = "Yes"
    fake_model(o)
    d = client.post(A, json={"cr_text": CR}).json()
    assert d["overall_conclusion"] == "Needs Review" and any("missing_regulations" in w for w in d["warnings"])


def test_ambiguous(client, fake_model):
    o = out(compliance_table=[]); o["cr_metadata"]["is_ambiguous"] = True
    fake_model(o)
    d = client.post(A, json={"cr_text": CR}).json()
    assert d["status"] == "needs_clarification" and d["overall_conclusion"] == "Needs Review"


@pytest.mark.parametrize("mut", [
    lambda o: o.update(compliance_table=[]),
    lambda o: o["compliance_table"].append(dict(o["compliance_table"][0])),
    lambda o: o["compliance_table"][0].pop("regulation"),
    lambda o: o.update(compliance_table="oops"),
])
def test_invalid_model_output_is_stored_and_502(client, fake_model, mut):
    o = out(); mut(o); fake_model(o)
    r = client.post(A, json={"cr_text": CR})
    assert r.status_code == 502 and code(r) == "invalid_model_output"
    aid = r.json()["error"]["details"]["assessment_id"]
    g = client.get(f"{A}/{aid}").json()
    assert g["status"] == "invalid_model_output" and g["error"]["code"] == "invalid_model_output"


def test_model_not_object(client, fake_model):
    fake_model(["not", "an", "object"])
    assert code(client.post(A, json={"cr_text": CR})) == "invalid_model_output"


@pytest.mark.parametrize("err,status", [("model_timeout", 504), ("model_unreachable", 502), ("model_bad_response", 502)])
def test_model_failures_stored(client, fake_model, err, status):
    fake_model(ModelCallError(err, "boom"))
    r = client.post(A, json={"cr_text": CR})
    assert r.status_code == status and code(r) == err
    h = client.get(A).json()["items"][0]
    assert h["status"] == "model_error"


def test_unexpected_model_exception(client, fake_model):
    fake_model(RuntimeError("secret internals"))
    r = client.post(A, json={"cr_text": CR})
    assert r.status_code == 502 and "secret" not in r.text


# ---------- history, idempotency, reassess, analytics ----------
def test_idempotency(client):
    h = {"Idempotency-Key": "k1"}
    a = client.post(A, json={"cr_text": CR}, headers=h)
    b = client.post(A, json={"cr_text": CR}, headers=h)
    assert a.status_code == 201 and b.status_code == 200 and b.headers["Idempotent-Replay"] == "true"
    assert a.json()["id"] == b.json()["id"] and client.get(A).json()["total"] == 1


def test_reassess_keeps_old(client):
    a = client.post(A, json={"cr_text": CR}).json()
    b = client.post(f"{A}/{a['id']}/reassess")
    assert b.status_code == 201 and b.json()["id"] != a["id"] and b.json()["parent_assessment_id"] == a["id"]
    assert b.json()["cr_id"] == a["cr_id"]
    assert client.get(f"{A}/{a['id']}").json()["compliance_table"] == a["compliance_table"]
    assert client.get(A, params={"cr_id": a["cr_id"]}).json()["total"] == 2


def test_cr_dedupe_ignores_case_whitespace(client):
    a = client.post(A, json={"cr_text": CR}).json()
    b = client.post(A, json={"cr_text": "  " + CR.upper().replace(" ", "   ")}).json()
    assert a["cr_id"] == b["cr_id"]


def test_history_filters_and_paging(client):
    client.post(A, json={"cr_text": CR})
    client.post(A, json={"cr_text": "Add a plain new label field to the report"})
    client.post(A, json={"cr_text": "Rename the counterparty column in the output"})
    assert client.get(A).json()["total"] == 3
    assert client.get(A, params={"overall": "Do Not Proceed"}).json()["total"] == 1
    assert client.get(A, params={"regulation": "emir", "effective_status": "non_compliant"}).json()["total"] == 1
    assert client.get(A, params={"q": "label"}).json()["total"] == 1
    p = client.get(A, params={"limit": 2, "offset": 2}).json()
    assert len(p["items"]) == 1 and p["total"] == 3
    assert client.get(A, params={"limit": 500}).status_code == 422
    assert client.get(A, params={"overall": "bogus"}).status_code == 422


def test_not_found(client):
    r = client.get(f"{A}/nope")
    assert r.status_code == 404 and code(r) == "assessment_not_found"
    assert client.post(f"{A}/nope/reassess").status_code == 404


def test_analytics(client):
    a = client.post(A, json={"cr_text": CR}).json()
    client.post(f"{A}/{a['id']}/reassess")
    client.post(A, json={"cr_text": "Add a plain new label field to the report"})
    h = {x["regulation"]: x for x in client.get("/api/analytics/heatmap").json()["items"]}
    assert h["EMIR"]["total"] == 2 and h["EMIR"]["non_compliant"] == 1 and h["EMIR"]["conflict_rate"] == 50.0
    h = {x["regulation"]: x for x in client.get("/api/analytics/heatmap", params={"latest_per_cr": "false"}).json()["items"]}
    assert h["EMIR"]["total"] == 3


# ---------- platform ----------
def test_api_key(client):
    from app.config import settings
    settings.api_key = "secret"
    assert code(client.post(A, json={"cr_text": CR})) == "unauthorized"
    assert client.get(A).status_code == 401
    assert client.get("/api/health").status_code == 200  # health stays open
    assert client.post(A, json={"cr_text": CR}, headers={"X-API-Key": "secret"}).status_code == 201


def test_health_and_404_shape(client):
    assert client.get("/api/health").json()["database"] == "up"
    r = client.get("/nothing")
    assert r.status_code == 404 and r.json()["error"]["code"] == "http_404"


def test_request_id_echo(client):
    assert client.get("/api/health", headers={"X-Request-ID": "abc"}).headers["X-Request-ID"] == "abc"


# ---------- the real (updated) model output format ----------
def test_real_model_output_sample(client, fake_model):
    import json, pathlib
    fake_model(json.loads((pathlib.Path(__file__).parent / "sample_model_output.json").read_text(encoding="utf-8")))
    d = client.post(A, json={"cr_text": "Update the event timestamp reporting field to capture date and time"}).json()
    assert d["overall_conclusion"] == "Do Not Proceed" and d["risk_score"] == 40.0 and d["warnings"] == []
    emir = d["compliance_table"][0]
    assert emir["effective_status"] == "non_compliant" and emir["catalog_size"] == 192
    assert emir["mapped_fields"]["R1"][1] == "Event date" and emir["findings"][0]["spec_constraint"].startswith("format YYYY")
    assert d["conflict_heatmap"]["EMEA"]["risk_status"] == "High Risk"
    assert d["spectrum_of_complexity"][0]["severity"] == "Critical"
    assert d["clarification_prompt"] is None and d["source_discrepancies"] == []
    assert client.get(f"{A}/{d['id']}").json() == d


def test_discrepancies_and_vote_errors_force_review(client, fake_model):
    import json, pathlib
    o = json.loads((pathlib.Path(__file__).parent / "sample_model_output.json").read_text(encoding="utf-8"))
    for r in o["compliance_table"][:2]:
        r["compliant"] = "Yes"; r["reason_if_not_compliant"] = ""
    o["compliance_table"][2]["vote_errors"] = ["voter 2 timed out"]
    o["source_discrepancies"] = [{"note": "x"}]
    fake_model(o)
    d = client.post(A, json={"cr_text": "Update the event timestamp reporting field"}).json()
    asic = d["compliance_table"][2]
    assert asic["effective_status"] == "needs_review" and "vote_errors" in asic["flags"]
    assert d["overall_conclusion"] == "Needs Review" and any("source_discrepancies" in w for w in d["warnings"])


def test_region_heatmap_from_model_json(client, fake_model):
    import json, pathlib
    fake_model(json.loads((pathlib.Path(__file__).parent / "sample_model_output.json").read_text(encoding="utf-8")))
    client.post(A, json={"cr_text": "Update the event timestamp reporting field"})
    h = client.get("/api/analytics/heatmap").json()
    by = {r["region"]: r for r in h["by_region"]}
    assert by["EMEA"]["risk_status"] == {"High Risk": 1} and by["EMEA"]["non_compliant_regulations"] == {"EMIR": 1, "UKEMIR": 1}
    assert by["APAC"]["risk_status"] == {"Safe to Implement": 1}


def test_http_model_passes_on_the_services_explanation(monkeypatch):
    import httpx
    from app.config import settings
    from app.model_client import HttpModel
    monkeypatch.setattr(settings, "model_retries", 0)
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(502, json={"detail": "DAILY quota reached - retry tomorrow"}))
    with pytest.raises(ModelCallError) as e:
        HttpModel().call("x")
    assert e.value.code == "model_unavailable" and "DAILY quota reached" in e.value.message
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(400, json={"detail": "cr_text is empty"}))
    with pytest.raises(ModelCallError) as e:
        HttpModel().call("x")
    assert e.value.code == "model_rejected" and "cr_text is empty" in e.value.message


def test_get_model_health_url():
    from app.config import settings
    from app.model_client import get_model_health_url
    old = settings.model_url
    try:
        settings.model_url = "https://impart-model-service.onrender.com/api/evaluate"
        assert get_model_health_url() == "https://impart-model-service.onrender.com/health"
        settings.model_url = "http://localhost:8001/api/evaluate"
        assert get_model_health_url() == "http://localhost:8001/health"
    finally:
        settings.model_url = old


def test_ping_model_service_sync_handles_exceptions(monkeypatch):
    import httpx
    from app.config import settings
    from app.model_client import ping_model_service_sync
    monkeypatch.setattr(settings, "model_mode", "http")
    monkeypatch.setattr(settings, "model_url", "http://localhost:8001/api/evaluate")
    # Simulate network failure during container wake-up: should swallow exception gracefully
    monkeypatch.setattr(httpx.Client, "get", lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("Connection refused")))
    ping_model_service_sync()  # Should not raise


def test_http_model_cold_boot_retry_success(monkeypatch):
    import httpx
    import time
    from app.config import settings
    from app.model_client import HttpModel

    monkeypatch.setattr(settings, "model_retries", 2)
    monkeypatch.setattr(settings, "model_cold_boot_retries", 3)
    monkeypatch.setattr(time, "sleep", lambda s: None)  # speed up test

    calls = [0]
    def fake_post(*a, **k):
        calls[0] += 1
        if calls[0] == 1:
            return httpx.Response(503, json={"detail": "Service Unavailable - Booting"})
        return httpx.Response(200, json={"disclaimer": "ok", "compliance_table": []})

    monkeypatch.setattr(httpx, "post", fake_post)
    res = HttpModel().call("test cr text")
    assert res == {"disclaimer": "ok", "compliance_table": []}
    assert calls[0] == 2


def test_http_model_429_rate_limit_retry(monkeypatch):
    import httpx
    import time
    from app.config import settings
    from app.model_client import HttpModel

    monkeypatch.setattr(settings, "model_retries", 2)
    monkeypatch.setattr(settings, "model_cold_boot_retries", 3)
    monkeypatch.setattr(time, "sleep", lambda s: None)

    calls = [0]
    def fake_post(*a, **k):
        calls[0] += 1
        if calls[0] == 1:
            return httpx.Response(429, headers={"Retry-After": "1"}, json={"detail": "Too Many Requests"})
        return httpx.Response(200, json={"disclaimer": "ok", "compliance_table": []})

    monkeypatch.setattr(httpx, "post", fake_post)
    res = HttpModel().call("test cr text")
    assert res == {"disclaimer": "ok", "compliance_table": []}
    assert calls[0] == 2


