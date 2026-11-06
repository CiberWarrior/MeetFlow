-- 065: Make registration-attachments private
--
-- Uploads already go through the service-role API route. Organizers read files
-- through an authorized signed URL. Public insert and public read are removed.
-- The service-role policy is left in place.

UPDATE storage.buckets
SET public = false
WHERE id = 'registration-attachments';

DROP POLICY IF EXISTS "Allow public upload registration attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read registration attachments" ON storage.objects;
