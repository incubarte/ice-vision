import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { GameSummary } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const summariesDir = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'tournaments', tournamentId, 'summaries');

    // Check if summaries directory exists
    try {
      await fs.access(summariesDir);
    } catch {
      // Directory doesn't exist, return empty object
      return NextResponse.json({});
    }

    // Read all summary files
    const files = await fs.readdir(summariesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const summaries: Record<string, GameSummary> = {};

    // Load each summary file
    await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(summariesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const summary = JSON.parse(content) as GameSummary;

          // Extract match ID from filename (remove .json extension)
          const matchId = file.replace('.json', '');
          summaries[matchId] = summary;
        } catch (error) {
          console.error(`Error loading summary file ${file}:`, error);
        }
      })
    );

    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Error loading tournament summaries:', error);
    return NextResponse.json({}, { status: 500 });
  }
}
