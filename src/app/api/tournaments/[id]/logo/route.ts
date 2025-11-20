import { NextResponse } from 'next/server';
import { storageProvider } from '@/lib/storage';
import { FileNotFoundError } from '@/lib/storage/providers';
import { updateManifestEntry, removeManifestEntry } from '@/lib/sync-manifest';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = await params;

    try {
        const logoPath = `tournaments/${tournamentId}/logo.png`;
        // The file is already stored as base64 text, just read it as string
        const logoData = await storageProvider.readFile(logoPath);

        return NextResponse.json({
            success: true,
            logo: `data:image/png;base64,${logoData}`
        });
    } catch (error) {
        if (error instanceof FileNotFoundError) {
            return NextResponse.json({ success: true, logo: null });
        }
        console.error('Error reading tournament logo:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to read tournament logo'
        }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
        return NextResponse.json({
            success: false,
            message: 'La aplicación está en modo de solo lectura. No se permiten escrituras.'
        }, { status: 403 });
    }

    const { id: tournamentId } = await params;

    try {
        const { logo } = await request.json() as { logo: string };

        if (!logo) {
            return NextResponse.json({
                success: false,
                message: 'No logo data provided'
            }, { status: 400 });
        }

        // Remove data URL prefix if present
        const base64Data = logo.replace(/^data:image\/\w+;base64,/, '');

        const logoPath = `tournaments/${tournamentId}/logo.png`;
        // Store the logo as base64 text (not binary)
        await storageProvider.writeFile(logoPath, base64Data);

        // Update manifest for Supabase sync
        // Convert base64 to buffer to string for consistent hashing
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            const contentForHash = buffer.toString('binary');
            await updateManifestEntry(logoPath, contentForHash);
            console.log(`[Tournament Logo] Manifest updated for: ${logoPath}`);
        } catch (manifestError) {
            console.error('[Tournament Logo] Error updating manifest:', manifestError);
            // Don't fail the request if manifest update fails
        }

        // Trigger storage change notification to sync with other instances
        await storageProvider.writeFile(`tournaments/${tournamentId}/.logo-updated`, Date.now().toString());

        return NextResponse.json({
            success: true,
            message: 'Logo saved successfully'
        });
    } catch (error) {
        console.error('Error saving tournament logo:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to save tournament logo'
        }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
        return NextResponse.json({
            success: false,
            message: 'La aplicación está en modo de solo lectura. No se permiten escrituras.'
        }, { status: 403 });
    }

    const { id: tournamentId } = await params;

    try {
        const logoPath = `tournaments/${tournamentId}/logo.png`;
        await storageProvider.deleteFile(logoPath);

        // Remove from manifest for Supabase sync
        try {
            await removeManifestEntry(logoPath);
            console.log(`[Tournament Logo] Removed from manifest: ${logoPath}`);
        } catch (manifestError) {
            console.error('[Tournament Logo] Error removing from manifest:', manifestError);
            // Don't fail the request if manifest update fails
        }

        // Trigger storage change notification to sync with other instances
        await storageProvider.writeFile(`tournaments/${tournamentId}/.logo-updated`, Date.now().toString());

        return NextResponse.json({
            success: true,
            message: 'Logo deleted successfully'
        });
    } catch (error) {
        if (error instanceof FileNotFoundError) {
            return NextResponse.json({ success: true, message: 'Logo already deleted' });
        }
        console.error('Error deleting tournament logo:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to delete tournament logo'
        }, { status: 500 });
    }
}
