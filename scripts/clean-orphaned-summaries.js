#!/usr/bin/env node

/**
 * Script to identify and move orphaned summaries
 * Orphaned summaries are summary files that exist in the filesystem
 * but are not referenced by any match in the fixture.json
 */

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'tmp', 'new-storage', 'data', 'tournaments');

async function cleanOrphanedSummaries() {
  console.log('🔍 Starting orphaned summaries cleanup...\n');

  try {
    // Get all tournament directories
    const tournamentDirs = await fs.readdir(DATA_DIR);

    let totalOrphans = 0;
    let totalProcessed = 0;

    for (const tournamentId of tournamentDirs) {
      if (tournamentId.startsWith('.')) continue; // Skip hidden files

      const tournamentPath = path.join(DATA_DIR, tournamentId);
      const stat = await fs.stat(tournamentPath);

      if (!stat.isDirectory()) continue;

      console.log(`📂 Processing tournament: ${tournamentId}`);

      const fixturePath = path.join(tournamentPath, 'fixture.json');
      const summariesPath = path.join(tournamentPath, 'summaries');

      // Check if fixture and summaries exist
      try {
        await fs.access(fixturePath);
        await fs.access(summariesPath);
      } catch (err) {
        console.log(`   ⚠️  Missing fixture.json or summaries folder, skipping\n`);
        continue;
      }

      // Read fixture.json
      const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
      const fixture = JSON.parse(fixtureContent);
      const matchIds = new Set((fixture.matches || []).map(m => m.id));

      console.log(`   📋 Found ${matchIds.size} matches in fixture`);

      // Read all summary files
      const summaryFiles = await fs.readdir(summariesPath);
      const summaryJsonFiles = summaryFiles.filter(f => f.endsWith('.json'));

      console.log(`   📄 Found ${summaryJsonFiles.length} summary files`);

      // Find orphaned summaries
      const orphanedSummaries = [];
      for (const summaryFile of summaryJsonFiles) {
        const matchId = summaryFile.replace('.json', '');
        if (!matchIds.has(matchId)) {
          orphanedSummaries.push(summaryFile);
        }
      }

      if (orphanedSummaries.length > 0) {
        console.log(`   🗑️  Found ${orphanedSummaries.length} orphaned summaries`);

        // Create orphaned-summaries folder
        const orphanedPath = path.join(tournamentPath, 'orphaned-summaries');
        await fs.mkdir(orphanedPath, { recursive: true });

        // Move orphaned summaries
        for (const orphanedFile of orphanedSummaries) {
          const sourcePath = path.join(summariesPath, orphanedFile);
          const destPath = path.join(orphanedPath, orphanedFile);
          await fs.rename(sourcePath, destPath);
          console.log(`      ↪️  Moved: ${orphanedFile}`);
        }

        totalOrphans += orphanedSummaries.length;
      } else {
        console.log(`   ✅ No orphaned summaries found`);
      }

      totalProcessed++;
      console.log('');
    }

    console.log('✨ Cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Tournaments processed: ${totalProcessed}`);
    console.log(`   - Total orphaned summaries moved: ${totalOrphans}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the script
cleanOrphanedSummaries();
