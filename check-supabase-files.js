const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://uuvhibznebwdbxcttufu.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1dmhpYnpuZWJ3ZGJ4Y3R0dWZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc1ODQ2OSwiZXhwIjoyMDc4MzM0NDY5fQ.fKz-Fm3jLSfv-dfFtHbMgWtQaCpcKrQ78K8CsdniSEA";
const bucket = "ice-vision-sandbox";

const supabase = createClient(supabaseUrl, serviceKey);

async function listAllFiles(prefix = '', level = 0) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });

    if (error) {
        console.error(`Error listing ${prefix}:`, error.message);
        return [];
    }

    let allFiles = [];
    const indent = '  '.repeat(level);

    for (const item of data) {
        const itemPath = prefix ? `${prefix}/${item.name}` : item.name;

        // Check if it's a folder (has no size or is marked as folder)
        const isFolder = item.id === null || item.metadata?.mimetype === 'application/x-directory';

        if (isFolder) {
            console.log(`${indent}📁 ${item.name}/`);
            const subFiles = await listAllFiles(itemPath, level + 1);
            allFiles = allFiles.concat(subFiles);
        } else {
            const sizeKB = (item.metadata?.size || 0) / 1024;
            console.log(`${indent}📄 ${item.name} (${sizeKB.toFixed(2)} KB)`);
            allFiles.push(itemPath);
        }
    }

    return allFiles;
}

async function main() {
    console.log(`Scanning bucket: ${bucket}\n`);
    console.log('='.repeat(60));

    const allFiles = await listAllFiles();

    console.log('='.repeat(60));
    console.log(`\nTotal files: ${allFiles.length}`);

    // Count by type
    const byExtension = {};
    allFiles.forEach(file => {
        const ext = file.split('.').pop() || 'no-extension';
        byExtension[ext] = (byExtension[ext] || 0) + 1;
    });

    console.log('\nFiles by type:');
    Object.entries(byExtension).sort((a, b) => b[1] - a[1]).forEach(([ext, count]) => {
        console.log(`  ${ext}: ${count}`);
    });

    // Look for logo files specifically
    const logoFiles = allFiles.filter(f => f.includes('logo'));
    console.log(`\nLogo files found: ${logoFiles.length}`);
    logoFiles.forEach(f => console.log(`  - ${f}`));
}

main().catch(console.error);
