-- B extends the existing versioned A state/history, claim and retention path.
-- No duplicate content/evidence tables; no runtime application of migrations.
ALTER TABLE intelligent_learning_records DROP CONSTRAINT intelligent_learning_records_kind_check;
ALTER TABLE intelligent_learning_records ADD CONSTRAINT intelligent_learning_records_kind_check
 CHECK(kind IN ('decision','activity','review','tutor','goal','reflection','scaffold','lab'));
CREATE INDEX intelligent_learning_lab_lesson ON intelligent_learning_records
 (owner_key,(data->>'lessonRevisionId'),(data->>'blockIndex')) WHERE kind='lab';
