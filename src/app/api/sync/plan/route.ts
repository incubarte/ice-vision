import { NextResponse } from 'next/server';
import { readPlan, writePlan, deletePlan, updateConflictDecisions } from '@/lib/sync-plan';

export const dynamic = 'force-dynamic';

/**
 * GET - Read current sync plan
 */
export async function GET() {
    try {
        const plan = await readPlan();

        if (!plan) {
            return NextResponse.json(
                { error: 'No plan found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ plan });
    } catch (error) {
        console.error('[Plan API] Error reading plan:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * POST - Update conflict decisions in plan
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { decisions } = body;

        if (!decisions || !Array.isArray(decisions)) {
            return NextResponse.json(
                { error: 'Decisions array required' },
                { status: 400 }
            );
        }

        const updatedPlan = await updateConflictDecisions(decisions);

        if (!updatedPlan) {
            return NextResponse.json(
                { error: 'No plan found to update' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            plan: updatedPlan
        });
    } catch (error) {
        console.error('[Plan API] Error updating plan:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE - Delete sync plan
 */
export async function DELETE() {
    try {
        await deletePlan();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Plan API] Error deleting plan:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
