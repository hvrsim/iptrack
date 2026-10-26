-- Local development sample data only; does not create a login session.
INSERT OR IGNORE INTO auth_user(id,name,email,email_verified) VALUES ('local-sample','Sample project owner','sample@example.test',1);
INSERT OR IGNORE INTO projects(id,user_id,name) VALUES ('11111111-1111-4111-8111-111111111111','local-sample','Local collector sample');
INSERT OR IGNORE INTO project_domains(id,project_id,hostname,wildcard) VALUES ('local-domain','11111111-1111-4111-8111-111111111111','localhost',0);
