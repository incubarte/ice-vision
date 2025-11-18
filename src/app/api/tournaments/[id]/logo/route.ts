import { NextResponse } from 'next/server';
import { storageProvider } from '@/lib/storage';
import { FileNotFoundError } from '@/lib/storage/providers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = await params;

    try {
        const logoPath = `tournaments/${tournamentId}/logo.png`;
        const logoData = await storageProvider.readFile(logoPath, 'base64');

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
        await storageProvider.writeFile(logoPath, base64Data, 'base64');

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
