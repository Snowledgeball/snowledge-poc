import { prisma } from '@/lib/prisma'
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
    try {
        const { id, communityId } = await params;
        const userId = parseInt(id);
        const parsedCommunityId = parseInt(communityId);

        const posts = await prisma.community_posts.findMany({
            where: {
                community_id: parsedCommunityId,
                author_id: userId
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        return NextResponse.json(posts);
    } catch (error) {
        console.log("Erreur lors de la récupération des posts:", error.stack);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des posts" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
} 