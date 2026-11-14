UPDATE public.documents SET file_path = NULL WHERE file_path IS NOT NULL AND split_part(file_path,'/',1) <> user_id::text;
ALTER TABLE public.documents ADD CONSTRAINT documents_file_path_owner CHECK (file_path IS NULL OR split_part(file_path,'/',1) = user_id::text);
