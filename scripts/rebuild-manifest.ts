#!/usr/bin/env tsx
/**
 * Rebuild sync-manifest.json from existing files
 *
 * This script scans all tournament files and creates a fresh manifest.
 * Useful for:
 * - Recovering from corrupted manifest
 * - Initializing manifest for existing data
 * - Migrating to new manifest format
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { LocalFileStorageProvider } from '../src/lib/storage/providers';
import { hashContent, getGMTTimestamp, writeManifest } from '../src/lib/sync-manifest';
import type { SyncManifest } from '../src/types';

const storageProvider = new LocalFileStorageProvider();

async function rebuildManifest() {
    console.log('🔧 Rebuilding sync-manifest.json...\n');

    const manifest: SyncManifest = {
        lastSync: getGMTTimestamp(),
        files: {}
    };

    // Files to track
    const filesToTrack = [
        'tournaments.json'
    ];

    try {
        // 1. Add tournaments.json
        console.log('📄 Processing tournaments.json...');
        try {
            const content = await storageProvider.readFile('tournaments.json');
            manifest.files['tournaments.json'] = {
                lastModified: getGMTTimestamp(),
                hash: hashContent(content),
                size: Buffer.byteLength(content, 'utf8')
            };
            console.log('  ✅ Added tournaments.json');
        } catch (err) {
            console.log('  ⚠️  tournaments.json not found, skipping');
        }

        // 2. Find all tournament directories
        console.log('\n📂 Scanning tournament directories...');
        const tournamentsDir = await storageProvider.listFiles('tournaments');

        for (const tournamentId of tournamentsDir) {
            console.log(`\n  Tournament: ${tournamentId}`);
            const tournamentPrefix = `tournaments/${tournamentId}`;

            // Add teams.json
            try {
                const teamsPath = `${tournamentPrefix}/teams.json`;
                const teamsContent = await storageProvider.readFile(teamsPath);
                manifest.files[teamsPath] = {
                    lastModified: getGMTTimestamp(),
                    hash: hashContent(teamsContent),
                    size: Buffer.byteLength(teamsContent, 'utf8')
                };
                console.log(`    ✅ ${teamsPath}`);
            } catch (err) {
                console.log(`    ⚠️  teams.json not found`);
            }

            // Add fixture.json
            try {
                const fixturePath = `${tournamentPrefix}/fixture.json`;
                const fixtureContent = await storageProvider.readFile(fixturePath);
                manifest.files[fixturePath] = {
                    lastModified: getGMTTimestamp(),
                    hash: hashContent(fixtureContent),
                    size: Buffer.byteLength(fixtureContent, 'utf8')
                };
                console.log(`    ✅ ${fixturePath}`);
            } catch (err) {
                console.log(`    ⚠️  fixture.json not found`);
            }

            // Add all summaries
            try {
                const summariesPath = `${tournamentPrefix}/summaries`;
                const summaries = await storageProvider.listFiles(summariesPath);

                for (const summaryFile of summaries) {
                    const summaryPath = `${summariesPath}/${summaryFile}`;
                    const summaryContent = await storageProvider.readFile(summaryPath);
                    manifest.files[summaryPath] = {
                        lastModified: getGMTTimestamp(),
                        hash: hashContent(summaryContent),
                        size: Buffer.byteLength(summaryContent, 'utf8')
                    };
                }
                console.log(`    ✅ ${summaries.length} summaries added`);
            } catch (err) {
                console.log(`    ⚠️  No summaries found`);
            }
        }

        // 3. Write manifest
        console.log('\n💾 Writing manifest...');
        await writeManifest(manifest);

        console.log('\n🎉 Manifest rebuilt successfully!');
        console.log(`\nSummary:`);
        console.log(`  Total files tracked: ${Object.keys(manifest.files).length}`);
        console.log(`  Manifest created at: ${manifest.lastSync}`);

    } catch (error) {
        console.error('\n❌ Failed to rebuild manifest:', error);
        process.exit(1);
    }
}

rebuildManifest();
