#!/usr/bin/env tsx
/**
 * Migration script to split tournaments from config.json into tournaments.json
 *
 * This script:
 * 1. Reads the current config.json
 * 2. Extracts the tournaments array
 * 3. Saves tournaments to tournaments.json
 * 4. Saves config without tournaments back to config.json
 */

// IMPORTANT: Load .env BEFORE any other imports that might use env vars
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

// Now import modules that depend on env vars
import { LocalFileStorageProvider } from '../src/lib/storage/providers';
import type { ConfigState, TournamentsData } from '../src/types';

// Create storage provider instance AFTER env vars are loaded
const storageProvider = new LocalFileStorageProvider();

async function migrateTournamentsToSeparateFile() {
    console.log('🚀 Starting tournaments migration...\n');
    console.log(`CWD: ${process.cwd()}`);
    console.log(`Storage provider: ${process.env.STORAGE_PROVIDER || 'local'}`);
    console.log(`Storage path: ${process.env.STORAGE_PATH || 'default (./storage)'}`);

    // Debug: show what the actual resolved path will be
    const storagePath = process.env.STORAGE_PATH || 'storage';
    const fullPath = resolve(process.cwd(), storagePath, 'data', 'config.json');
    console.log(`Expected config path: ${fullPath}\n`);

    try {
        // 1. Read current config.json
        console.log('📖 Reading config.json...');
        const configData = await storageProvider.readFile('config.json');
        const config = JSON.parse(configData) as ConfigState;
        console.log(`✅ Config loaded. Found ${config.tournaments?.length || 0} tournaments.\n`);

        // 2. Extract tournaments
        const { tournaments = [], ...configWithoutTournaments } = config;

        // 3. Save tournaments.json
        console.log('💾 Saving tournaments.json...');
        const tournamentsData: TournamentsData = { tournaments };
        await storageProvider.writeFile('tournaments.json', JSON.stringify(tournamentsData, null, 2));
        console.log(`✅ Saved ${tournaments.length} tournaments to tournaments.json\n`);

        // 4. Save config.json without tournaments
        console.log('💾 Saving updated config.json (without tournaments)...');
        await storageProvider.writeFile('config.json', JSON.stringify(configWithoutTournaments, null, 2));
        console.log('✅ Config.json updated\n');

        console.log('🎉 Migration completed successfully!');
        console.log('\nSummary:');
        console.log(`  - tournaments.json: ${tournaments.length} tournaments`);
        console.log(`  - config.json: tournaments array removed`);
        console.log('\nYou can now run the app with the new structure.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
        process.exit(1);
    }
}

// Run migration
migrateTournamentsToSeparateFile();
