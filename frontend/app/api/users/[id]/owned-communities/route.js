import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
    try {
        // Attendre les paramètres
        const { id } = await params;
        const userId = id;


        const communities = await prisma.community.findMany({
            where: {
                creator_id: parseInt(userId)
            },
            include: {
                community_contributors: true,
                community_learners: true,
                community_posts: true
            }
        });

        return NextResponse.json({
            communities: communities.map(community => ({
                id: community.id,
                name: community.name,
                description: community.description,
                createdAt: community.created_at,
                isComplete: Boolean(community.description && community.image_url),
                stats: {
                    membersCount: community.community_learners.length,
                    postsCount: community.community_posts.length,
                    revenue: 0 // À implémenter
                }
            }))
        });

    } catch (error) {
        console.error('Erreur:', error);
        return NextResponse.json(
            { error: 'Erreur lors de la récupération des communautés' },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
} 