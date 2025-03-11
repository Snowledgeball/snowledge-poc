"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { Community } from "@/types/community";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import ChatBox from "@/components/shared/ChatBox";
import QASection from "@/components/shared/QASection";
import VotingSession from "@/components/community/VotingSession";
import CommunityHeader from "@/components/community/CommunityHeader";
import CommunityBanner from "@/components/community/CommunityBanner";
import CommunityTabs from "@/components/community/CommunityTabs";
import CommunityPosts from "@/components/community/CommunityPosts";
import CommunityPresentationModal from "@/components/community/CommunityPresentationModal";
import BanModal from "@/components/community/BanModal";


// Ajouter ce type avant le composant CommunityHub
type Presentation = {
  video_url?: string;
  topic_details: string;
  code_of_conduct: string;
  disclaimers: string;
};

// Ajouter l'interface Post
interface Post {
  id: number;
  title: string;
  content: string;
  cover_image_url: string | null;
  tag: string;
  created_at: string;
  accept_contributions: boolean;
  user: {
    id: number;
    fullName: string;
    profilePicture: string;
  };
  status: string;
}

const CommunityHub = () => {
  const { isLoading, isAuthenticated, LoadingComponent } = useAuthGuard();
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [communityData, setCommunityData] = useState<Community | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isContributor, setIsContributor] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [pendingPostsCount, setPendingPostsCount] = useState(0);
  const [pendingEnrichmentsCount, setPendingEnrichmentsCount] = useState(0);
  const [bans, setBans] = useState<any[]>([]);
  const [votingSubTab, setVotingSubTab] = useState<"creation" | "enrichissement">("creation");

  useEffect(() => {
    if (!session) {
      return;
    } else if (userId === null) {
      setUserId(session.user.id);
    }

    const checkMembershipAndFetchData = async () => {
      try {
        // Vérifier si l'utilisateur est membre
        const membershipResponse = await fetch(
          `/api/communities/${params.id}/membership`
        );

        const membershipData = await membershipResponse.json();

        console.log("membershipData", membershipData);

        // Récupérer les données de la communauté
        const communityResponse = await fetch(`/api/communities/${params.id}`);
        if (!communityResponse.ok) {
          router.push("/404");
          return;
        }
        const communityData = await communityResponse.json();
        setCommunityData(communityData);

        // Récupérer les Membres bannis
        const bansResponse = await fetch(`/api/communities/${params.id}/members/${session?.user?.id}/ban`);
        const bansData = await bansResponse.json();
        console.log("bansData", bansData);
        setBans(bansData);

        // Si l'utilisateur n'est pas membre ou banni, récupérer la présentation
        if (!membershipData.isMember && !membershipData.isCreator && !membershipData.isContributor && bansData.length === 0) {
          const presentationResponse = await fetch(
            `/api/communities/${params.id}/presentation`
          );
          const presentationData = await presentationResponse.json();
          setPresentation(presentationData);
          setShowJoinModal(true);
        }

        // Récupérer les communautés de l'utilisateur
        const userCommunitiesResponse = await fetch(
          `/api/users/${session?.user?.id}/joined-communities`
        );
        if (userCommunitiesResponse.ok) {
          const userCommunitiesData = await userCommunitiesResponse.json();
          setUserCommunities(userCommunitiesData.communities);
        }

        // Vérifier si l'utilisateur est contributeur
        setIsContributor(membershipData.isContributor);
        setIsCreator(communityData?.creator_id === parseInt(session?.user.id));

        // Si l'utilisateur est contributeur, récupérer le nombre de posts en attente
        if (membershipData.isContributor || membershipData.isCreator) {
          const fetchPendingPosts = async () => {
            try {
              const response = await fetch(
                `/api/communities/${params.id}/posts/pending`
              );
              if (response.ok) {
                const data = await response.json();
                setPendingPostsCount(data.length);
              }
            } catch (error) {
              console.error("Erreur:", error);
            }
          };
          const fetchPendingEnrichments = async () => {
            try {
              const response = await fetch(`/api/communities/${params.id}/posts/with-pending-enrichments`);
              if (response.ok) {
                const data = await response.json();
                setPendingEnrichmentsCount(data.length);
              }
            }
            catch (error) {
              console.error("Erreur:", error);
            }
          }
          fetchPendingPosts();
          fetchPendingEnrichments();
        }

        // Récupérer les posts de la communauté
        const communityPostsResponse = await fetch(
          `/api/communities/${params.id}/posts?status=PUBLISHED`
        );
        if (!communityPostsResponse.ok)
          throw new Error("Erreur lors de la récupération des posts");
        const data = await communityPostsResponse.json();
        setPosts(data);
      } catch (error) {
        if (error instanceof Error) {
          console.log("Erreur:", error.stack);
        } else {
          console.log("Une erreur inattendue s'est produite");
        }
        setUserCommunities([]);
      }
    };

    if (params.id) {
      checkMembershipAndFetchData();
    }
  }, [params.id, router, session]);

  // Si en cours de chargement, afficher le loader
  if (isLoading) {
    return <LoadingComponent />;
  }

  // Si non authentifié, ne rien afficher (la redirection est gérée par le hook)
  if (!isAuthenticated) {
    return null;
  }
  const getYoutubeVideoId = (url: string) => {
    const videoId = url.split("v=")[1];
    return videoId;
  };

  // Fonction pour gérer le changement de sous-onglet
  const handleVotingSubTabChange = (tab: "creation" | "enrichissement") => {
    setVotingSubTab(tab);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modal de présentation */}
      <CommunityPresentationModal
        communityData={communityData}
        presentation={presentation}
        userId={userId}
        showModal={showJoinModal}
      />

      {/* Modal de bannissement */}
      <BanModal bans={bans} />

      {/* Header avec gradient */}
      <CommunityHeader
        communityData={communityData}
        userCommunities={userCommunities}
        isContributor={isContributor}
        isCreator={isCreator}
        pendingPostsCount={pendingPostsCount}
        pendingEnrichmentsCount={pendingEnrichmentsCount}
        sessionUserId={session?.user?.id}
      />

      {/* Banner section */}
      <CommunityBanner communityData={communityData} />

      {session && (
        <div className="max-w-7xl mx-auto px-4 pb-12 ">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Contenu principal */}
            <main className="flex-1 order-1">
              {/* Tabs */}
              <CommunityTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isContributor={isContributor}
                isCreator={isCreator}
                pendingPostsCount={pendingPostsCount}
                pendingEnrichmentsCount={pendingEnrichmentsCount}
              />

              {/* Contenu basé sur l'onglet actif */}
              {activeTab === "general" ? (
                <Card className="bg-white shadow-sm">
                  <div className="h-[600px] flex flex-col">
                    {session && (
                      <ChatBox
                        user={session.user}
                        communityId={parseInt(String(params.id))}
                        className="h-full"
                      />
                    )}
                  </div>
                </Card>
              ) : activeTab === "voting" ? (
                <div>
                  <VotingSession
                    communityId={params.id as string}
                    activeTab={votingSubTab}
                    onTabChange={handleVotingSubTabChange}
                  />
                </div>
              ) : (
                <CommunityPosts
                  posts={posts}
                  communityId={params.id as string}
                  isContributor={isContributor}
                  userId={session?.user?.id}
                />
              )}
            </main>
          </div>

          {/* Section Q&A avec Disclosure */}
          <div className="mt-8">
            {activeTab === "general" && session && (
              <QASection
                communityId={params.id as string}
                isContributor={isContributor}
                isCreator={isCreator}
                userId={session?.user?.id}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityHub;
