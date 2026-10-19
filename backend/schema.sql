-- Generated from the SQLAlchemy models (MySQL). The app also creates these tables itself on startup.
-- Requires utf8mb4:  CREATE DATABASE impart CHARACTER SET utf8mb4;

CREATE TABLE change_requests (
	id VARCHAR(36) NOT NULL, 
	text TEXT NOT NULL, 
	text_hash VARCHAR(64) NOT NULL, 
	source_type VARCHAR(10) NOT NULL, 
	original_filename VARCHAR(255), 
	created_at DATETIME(6) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (text_hash)
);


CREATE TABLE assessments (
	id VARCHAR(36) NOT NULL, 
	cr_id VARCHAR(36) NOT NULL, 
	parent_assessment_id VARCHAR(36), 
	idempotency_key VARCHAR(100), 
	status VARCHAR(25) NOT NULL, 
	overall_conclusion VARCHAR(20), 
	risk_score FLOAT, 
	warnings JSON, 
	raw_model_output JSON, 
	error_code VARCHAR(40), 
	error_message TEXT, 
	model_mode VARCHAR(10) NOT NULL, 
	model_label VARCHAR(100) NOT NULL, 
	latency_ms INTEGER, 
	requested_by VARCHAR(100), 
	disclaimer VARCHAR(100) NOT NULL, 
	created_at DATETIME(6) NOT NULL, 
	completed_at DATETIME(6), 
	PRIMARY KEY (id), 
	FOREIGN KEY(cr_id) REFERENCES change_requests (id), 
	FOREIGN KEY(parent_assessment_id) REFERENCES assessments (id), 
	UNIQUE (idempotency_key)
);

CREATE INDEX ix_assessments_overall_conclusion ON assessments (overall_conclusion);
CREATE INDEX ix_assessments_cr_id ON assessments (cr_id);
CREATE INDEX ix_assessments_status ON assessments (status);
CREATE INDEX ix_assessments_created_at ON assessments (created_at);

CREATE TABLE assessment_results (
	id VARCHAR(36) NOT NULL, 
	assessment_id VARCHAR(36) NOT NULL, 
	position INTEGER NOT NULL, 
	regulation VARCHAR(20) NOT NULL, 
	region VARCHAR(10), 
	compliant VARCHAR(30) NOT NULL, 
	effective_status VARCHAR(15) NOT NULL, 
	reason_if_not_compliant TEXT, 
	citation TEXT, 
	quote TEXT, 
	quote_verified BOOL, 
	sources_disagree BOOL NOT NULL, 
	votes JSON, 
	findings JSON, 
	flags JSON NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(assessment_id) REFERENCES assessments (id) ON DELETE CASCADE
);

CREATE INDEX ix_assessment_results_assessment_id ON assessment_results (assessment_id);
CREATE INDEX ix_results_reg_status ON assessment_results (regulation, effective_status);

