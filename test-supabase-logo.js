// Test script to check if logo exists in Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://uuvhibznebwdbxcttufu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1dmhpYnpuZWJ3ZGJ4Y3R0dWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTg0NjksImV4cCI6MjA3ODMzNDQ2OX0.wuY5jQSKdiPzP7FdXy6t0zKqdf_QhRF6CO0Y3UAUFuk";
const bucket = "ice-vision-sandbox";

const supabase = createClient(supabaseUrl, anonKey);

async function testLogoRead() {
    // First, list files in the tournaments directory
    console.log('Listing files in tournaments directory...');
    const { data: listData, error: listError } = await supabase.storage.from(bucket).list('tournaments', { limit: 100 });

    if (listError) {
        console.error('Error listing files:', listError);
    } else {
        console.log('Files/folders in tournaments:', listData.map(f => f.name));
    }

    // Try to list files in specific tournament folder
    console.log('\nListing files in tournament folder...');
    const { data: tournamentFiles, error: tournamentError } = await supabase.storage.from(bucket).list('tournaments/8a422a4c-1953-4abd-acae-bf5cd358ef9c', { limit: 100 });

    if (tournamentError) {
        console.error('Error listing tournament files:', tournamentError);
    } else {
        console.log('Files in tournament folder:', tournamentFiles.map(f => f.name));
    }

    const logoPath = 'tournaments/8a422a4c-1953-4abd-acae-bf5cd358ef9c/logo.png';
    console.log(`\nAttempting to download: ${logoPath}`);

    const { data, error } = await supabase.storage.from(bucket).download(logoPath);

    if (error) {
        console.error('Error downloading file:', error);

        // Try with public URL instead
        console.log('\nTrying to get public URL...');
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(logoPath);
        console.log('Public URL:', publicUrlData.publicUrl);
        return;
    }

    console.log('Success! File downloaded');
    console.log('File type:', data.type);
    console.log('File size:', data.size);

    const text = await data.text();
    console.log('First 100 chars:', text.substring(0, 100));
}

testLogoRead().catch(console.error);
