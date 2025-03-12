"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Users, MessageCircle, Activity, Award, Wallet, Plus, ArrowRight, Mail, Lock, HelpCircle, MessageSquare, FileText, Check, Trophy, DollarSign, X, User, AtSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog } from '@headlessui/react';
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { toast } from "sonner";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// Système de cache pour les données du profil
const profileCache = {
    userData: new Map<string, { data: any, timestamp: number }>(),
    userCommunities: new Map<string, { data: any[], timestamp: number }>(),
    joinedCommunities: new Map<string, { data: any[], timestamp: number }>(),
    posts: new Map<string, { data: any[], timestamp: number }>(),
    communityPosts: new Map<string, { data: any[], timestamp: number }>(),
    enrichments: new Map<string, { data: any[], timestamp: number }>(),
    // Durée de validité du cache (5 minutes)
    expiresIn: 5 * 60 * 1000
};

// Fonction pour vérifier si le cache est valide
const isCacheValid = (cache: { timestamp: number }) => {
    return (Date.now() - cache.timestamp) < profileCache.expiresIn;
};

interface CommunityData {
    name: string;
    role: string;
    joinDate: string;
    contributionsCount: number;
    recentActivity: { type: string; title: string; date: string; engagement: number }[];
    revenue: string;
}

// Ajout des types pour la communauté
interface CommunityStats {
    membersCount: number;
    postsCount: number;
    revenue: number;
}

interface UserCommunity {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    stats: CommunityStats;
    isComplete: boolean;
}

// Ajout d'une nouvelle interface
interface JoinedCommunity {
    id: string;
    name: string;
    createdAt: string;
    role: string;
}

interface Post {
    id: string;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
}

interface Enrichment {
    id: number;
    content: string;
    description: string;
    status: string;
    created_at: string;
    community_posts: {
        id: number;
        title: string;
        community: {
            id: number;
            name: string;
            image_url: string;
        }
    }
}

const ProfilePage = () => {
    const { data: session } = useSession();
    const router = useRouter();

    const { isLoading: isLoadingAuth, isAuthenticated: isAuthenticatedAuth, LoadingComponent } = useAuthGuard();

    const [userOwnedCommunities, setUserOwnedCommunities] = useState<UserCommunity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // Modifier l'état des onglets pour inclure les nouvelles options
    const [activeTab, setActiveTab] = useState('communities'); // 'communities', 'settings', 'support', 'my-community', 'contributor'

    // Ajoutez l'état pour gérer le modal
    const [isContributorModalOpen, setIsContributorModalOpen] = useState(false);
    const [selectedCommunityForContribution, setSelectedCommunityForContribution] = useState<string | null>(null);
    const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunity[]>([]);
    const [isLoadingJoined, setIsLoadingJoined] = useState(true);
    const [selectedCommunity, setSelectedCommunity] = useState<UserCommunity | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [selectedCommunityPosts, setSelectedCommunityPosts] = useState<Post[]>([]);
    const [enrichments, setEnrichments] = useState<Enrichment[]>([]);
    const [userData, setUserData] = useState({
        fullName: '',
        userName: '',
        email: '',
        level: 0,
        memberSince: '',
        avatar: '/images/default-avatar.png',
        stats: {
            communitiesCount: 0,
            postsCount: 0,
            contributionsCount: 0,
            totalEarnings: 0
        }
    });
    const [justification, setJustification] = useState('');
    const [expertiseDomain, setExpertiseDomain] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Ajout des états pour gérer les modifications
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        fullName: '',
        userName: '',
        email: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        const userId = session?.user?.id;
        if (userId) {
            setUserId(userId);
        }
    }, [session]);


    // Fonction pour récupérer les données de l'utilisateur avec cache
    const fetchUserData = useCallback(async () => {
        if (!userId) return;

        try {
            // Vérifier si les données sont dans le cache et si le cache est encore valide
            const cacheKey = `user-${userId}`;
            if (profileCache.userData.has(cacheKey)) {
                const cachedData = profileCache.userData.get(cacheKey)!;
                if (isCacheValid(cachedData)) {
                    console.log("Utilisation des données utilisateur en cache");
                    setUserData(cachedData.data);
                    return;
                }
            }

            console.log("Récupération des données utilisateur depuis l'API");
            const response = await fetch(`/api/users/${userId}`, {
                headers: {
                    'Cache-Control': 'max-age=300', // Cache de 5 minutes côté serveur
                }
            });

            if (!response.ok) throw new Error('Erreur lors de la récupération des données utilisateur');

            const data = await response.json();

            // Mettre à jour le cache
            profileCache.userData.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            setUserData(data);
        } catch (error) {
            console.error('Erreur:', error);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) {
            fetchUserData();
        }
    }, [userId, fetchUserData]);


    // Fonction pour récupérer les communautés rejointes par l'utilisateur avec cache
    const fetchJoinedCommunities = useCallback(async () => {
        if (!userId) return;

        try {
            // Ne pas définir isLoadingJoined à true ici si joinedCommunities contient déjà des données
            // pour éviter une boucle infinie
            if (joinedCommunities.length === 0) {
                setIsLoadingJoined(true);
            }

            // Vérifier si les données sont dans le cache et si le cache est encore valide
            const cacheKey = `joined-communities-${userId}`;
            if (profileCache.joinedCommunities.has(cacheKey)) {
                const cachedData = profileCache.joinedCommunities.get(cacheKey)!;
                if (isCacheValid(cachedData)) {
                    console.log("Utilisation des communautés rejointes en cache");
                    setJoinedCommunities(cachedData.data);
                    setSelectedCommunity(cachedData.data[0] as unknown as UserCommunity);
                    setIsLoadingJoined(false);
                    return;
                }
            }

            console.log("Récupération des communautés rejointes depuis l'API");
            const response = await fetch(`/api/users/${userId}/joined-communities`, {
                headers: {
                    'Cache-Control': 'max-age=300', // Cache de 5 minutes côté serveur
                }
            });

            if (!response.ok) throw new Error('Erreur lors de la récupération des communautés rejointes');

            const data = await response.json();

            // Mettre à jour le cache
            profileCache.joinedCommunities.set(cacheKey, {
                data: data.communities,
                timestamp: Date.now()
            });

            setJoinedCommunities(data.communities);
            setSelectedCommunity(data.communities[0] as unknown as UserCommunity);
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setIsLoadingJoined(false);
        }
    }, [userId, joinedCommunities.length]);

    // Fonction pour récupérer les communautés créées par l'utilisateur avec cache
    const fetchUserCommunities = useCallback(async () => {
        if (!userId) return;

        try {
            // Ne pas définir isLoading à true ici si userOwnedCommunities contient déjà des données
            // pour éviter une boucle infinie
            if (userOwnedCommunities.length === 0) {
                setIsLoading(true);
            }

            // Vérifier si les données sont dans le cache et si le cache est encore valide
            const cacheKey = `user-communities-${userId}`;
            if (profileCache.userCommunities.has(cacheKey)) {
                const cachedData = profileCache.userCommunities.get(cacheKey)!;
                if (isCacheValid(cachedData)) {
                    console.log("Utilisation des communautés de l'utilisateur en cache");
                    setUserOwnedCommunities(cachedData.data);
                    setIsLoading(false);
                    return;
                }
            }

            console.log("Récupération des communautés de l'utilisateur depuis l'API");
            const response = await fetch(`/api/users/${userId}/owned-communities`, {
                headers: {
                    'Cache-Control': 'max-age=300', // Cache de 5 minutes côté serveur
                }
            });

            if (!response.ok) throw new Error('Erreur lors de la récupération des communautés');

            const data = await response.json();

            // Mettre à jour le cache
            profileCache.userCommunities.set(cacheKey, {
                data: data.communities,
                timestamp: Date.now()
            });

            setUserOwnedCommunities(data.communities);
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setIsLoading(false);
        }
    }, [userId, userOwnedCommunities.length]);

    // Fonction pour récupérer les posts avec cache
    const fetchPosts = useCallback(async () => {
        if (!userId) return;

        try {
            // Vérifier si les données sont dans le cache et si le cache est encore valide
            const cacheKey = `posts-${userId}`;
            if (profileCache.posts.has(cacheKey)) {
                const cachedData = profileCache.posts.get(cacheKey)!;
                if (isCacheValid(cachedData)) {
                    console.log("Utilisation des posts en cache");
                    setPosts(cachedData.data || []);
                    return;
                }
            }

            console.log("Récupération des posts depuis l'API");
            const response = await fetch(`/api/users/${userId}/posts`, {
                headers: {
                    'Cache-Control': 'max-age=300', // Cache de 5 minutes côté serveur
                }
            });

            if (!response.ok) throw new Error('Erreur lors de la récupération des posts');

            const data = await response.json();

            // S'assurer que data.posts existe, sinon utiliser data directement si c'est un tableau
            const postsData = Array.isArray(data.posts) ? data.posts :
                Array.isArray(data) ? data : [];

            // Mettre à jour le cache
            profileCache.posts.set(cacheKey, {
                data: postsData,
                timestamp: Date.now()
            });

            setPosts(postsData);
        } catch (error) {
            console.error('Erreur:', error);
            // En cas d'erreur, définir un tableau vide pour éviter les erreurs d'undefined
            setPosts([]);
        }
    }, [userId]);

    // Fonction pour récupérer les enrichissements avec cache
    const fetchEnrichments = useCallback(async () => {
        if (!userId) return;

        try {
            console.log("fetchEnrichments try");
            // Vérifier si les données sont dans le cache et si le cache est encore valide
            const cacheKey = `enrichments-${userId}`;
            if (profileCache.enrichments.has(cacheKey)) {
                console.log("fetchEnrichments has cacheKey");
                const cachedData = profileCache.enrichments.get(cacheKey)!;
                if (isCacheValid(cachedData)) {
                    console.log("Utilisation des enrichissements en cache");
                    setEnrichments(cachedData.data || []);
                    return;
                }
            }

            console.log("Récupération des enrichissements depuis l'API");
            const response = await fetch(`/api/users/${userId}/enrichments`, {
                headers: {
                    'Cache-Control': 'max-age=300', // Cache de 5 minutes côté serveur
                }
            });

            if (!response.ok) throw new Error('Erreur lors de la récupération des enrichissements');

            const data = await response.json();

            // S'assurer que data.enrichments existe, sinon utiliser data directement si c'est un tableau
            const enrichmentsData = Array.isArray(data.enrichments) ? data.enrichments :
                Array.isArray(data) ? data : [];


            // Mettre à jour le cache
            profileCache.enrichments.set(cacheKey, {
                data: enrichmentsData,
                timestamp: Date.now()
            });
            console.log("enrichmentsData", enrichmentsData);

            setEnrichments(enrichmentsData);
        } catch (error) {
            console.error('Erreur:', error);
            // En cas d'erreur, définir un tableau vide pour éviter les erreurs d'undefined
            setEnrichments([]);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) {
            fetchUserCommunities();
            fetchJoinedCommunities();
            fetchPosts();
            fetchEnrichments();
        }
    }, [userId, fetchUserCommunities, fetchJoinedCommunities, fetchPosts, fetchEnrichments]);

    useEffect(() => {
        if (selectedCommunity) {
            const fetchSelectedCommunityPosts = async () => {
                try {
                    // Vérifier si les données sont dans le cache et si le cache est encore valide
                    const cacheKey = `community-posts-${selectedCommunity.id}`;
                    if (profileCache.communityPosts.has(cacheKey)) {
                        const cachedData = profileCache.communityPosts.get(cacheKey)!;
                        if (isCacheValid(cachedData)) {
                            console.log("Utilisation des posts de la communauté en cache");
                            setSelectedCommunityPosts(cachedData.data || []);
                            return;
                        }
                    }

                    console.log("Récupération des posts de la communauté depuis l'API");
                    const response = await fetch(`/api/communities/${selectedCommunity.id}/posts`, {
                        headers: {
                            'Cache-Control': 'max-age=300', // Cache de 5 minutes côté serveur
                        }
                    });

                    if (!response.ok) throw new Error('Erreur lors de la récupération des posts de la communauté');

                    const data = await response.json();

                    // S'assurer que data.posts existe, sinon utiliser data directement si c'est un tableau
                    const postsData = Array.isArray(data.posts) ? data.posts :
                        Array.isArray(data) ? data : [];

                    // Mettre à jour le cache
                    profileCache.communityPosts.set(cacheKey, {
                        data: postsData,
                        timestamp: Date.now()
                    });

                    setSelectedCommunityPosts(postsData);
                } catch (error) {
                    console.error('Erreur:', error);
                    // En cas d'erreur, définir un tableau vide pour éviter les erreurs d'undefined
                    setSelectedCommunityPosts([]);
                }
            };

            // Utiliser une référence pour éviter les appels multiples
            const controller = new AbortController();
            fetchSelectedCommunityPosts();
            return () => {
                controller.abort();
            };
        } else {
            // Si aucune communauté n'est sélectionnée, définir un tableau vide
            setSelectedCommunityPosts([]);
        }
    }, [selectedCommunity]);

    // Fonction pour invalider le cache après une modification
    const invalidateCache = useCallback((cacheType: string, key: string) => {
        switch (cacheType) {
            case 'userData':
                profileCache.userData.delete(key);
                break;
            case 'userCommunities':
                profileCache.userCommunities.delete(key);
                break;
            case 'joinedCommunities':
                profileCache.joinedCommunities.delete(key);
                break;
            case 'posts':
                profileCache.posts.delete(key);
                break;
            case 'communityPosts':
                profileCache.communityPosts.delete(key);
                break;
            case 'enrichments':
                profileCache.enrichments.delete(key);
                break;
            default:
                // Invalider tous les caches
                profileCache.userData.clear();
                profileCache.userCommunities.clear();
                profileCache.joinedCommunities.clear();
                profileCache.posts.clear();
                profileCache.communityPosts.clear();
                profileCache.enrichments.clear();
        }
    }, []);

    // Fonction pour soumettre la candidature
    const handleContributorRequest = async () => {
        if (!selectedCommunityForContribution || !justification || !expertiseDomain) {
            setSubmitError('Veuillez remplir tous les champs');
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Trouver l'ID de la communauté sélectionnée
            const community = joinedCommunities.find(c => c.name === selectedCommunityForContribution);

            if (!community) {
                throw new Error('Communauté non trouvée');
            }

            const response = await fetch(`/api/communities/${community.id}/contributor-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    justification,
                    expertiseDomain,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Une erreur est survenue');
            }

            // Réinitialiser les champs et fermer le modal
            setJustification('');
            setExpertiseDomain('');
            setIsContributorModalOpen(false);

            toast.success('Votre candidature a été envoyée avec succès');

        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Une erreur est survenue');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Ajout des fonctions de gestion
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (field: string) => {
        try {
            const formDataToSend = new FormData();

            if (field === 'avatar' && avatarFile) {
                formDataToSend.append('image', avatarFile);
            } else if (field === 'password') {
                formDataToSend.append('currentPassword', formData.currentPassword);
                formDataToSend.append('newPassword', formData.newPassword);
                formDataToSend.append('confirmPassword', formData.confirmPassword);
            } else {
                formDataToSend.append(field, formData[field as keyof typeof formData]);
            }

            console.log("formDataToSend :", formDataToSend);

            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                body: formDataToSend,
            });

            if (!response.ok) throw new Error('Erreur lors de la mise à jour');

            toast.success('Mise à jour effectuée avec succès');
            setIsEditing(null);
            // Rafraîchir les données utilisateur
            fetchUserData();
        } catch (error) {
            toast.error('Erreur lors de la mise à jour', {
                description: error instanceof Error ? error.message : 'Une erreur est survenue',
            });
        }
    };

    if (isLoadingAuth) {
        return <LoadingComponent />;
    }

    if (!isAuthenticatedAuth) {
        return null;
    }
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* En-tête responsive */}
                <div className="bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#003E8A] to-[#16215B] rounded-2xl p-4 lg:p-8 mb-8">
                    <div className="flex flex-col lg:flex-row items-center">
                        <div className="w-24 h-24 bg-white rounded-full mr-6 flex items-center justify-center p-1 ring-4 ring-white/30">
                            <Image
                                src={userData.avatar}
                                alt="Avatar"
                                className="w-full h-full object-cover rounded-full"
                                width={96}
                                height={96}
                            />
                        </div>
                        <div className="text-white">
                            <h1 className="text-3xl font-bold tracking-tight">{userData.fullName}</h1>
                            <div className="flex items-center mt-2 space-x-4">
                                {/* <span className="flex items-center bg-white/10 px-3 py-1 rounded-full">
                                    <Shield className="w-4 h-4 mr-1" />
                                    Niveau {userData.level}
                                </span> */}
                                <span className="flex items-center bg-white/10 px-3 py-1 rounded-full">
                                    <Award className="w-4 h-4 mr-1" />
                                    Membre depuis {userData.memberSince}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Statistiques responsives */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: "Communautés rejointes", value: userData.stats.communitiesCount, icon: Users, color: "text-blue-500" },
                        { label: "Posts", value: userData.stats.postsCount, icon: MessageCircle, color: "text-green-500" },
                        { label: "Contributions", value: userData.stats.contributionsCount, icon: Activity, color: "text-purple-500" },
                        { label: "Gains totaux", value: `${userData.stats.totalEarnings}€`, icon: Wallet, color: "text-amber-500" },
                    ].map((stat, index) => (
                        <Card key={index} className="p-6 bg-white hover:bg-gray-50 transition-colors duration-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                </div>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.color} bg-gray-50`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Navigation principale */}
                <div className="border-b border-gray-200 mb-8">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            className={`border-b-2 py-4 px-1 text-sm font-medium transition-all duration-200 
                                ${activeTab === 'communities' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
                            onClick={() => setActiveTab('communities')}
                        >
                            Communautés
                        </button>
                        <button
                            className={`border-b-2 py-4 px-1 text-sm font-medium transition-all duration-200 
                                ${activeTab === 'my-community' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
                            onClick={() => setActiveTab('my-community')}
                        >
                            Ma Communauté
                        </button>
                        <button
                            className={`border-b-2 py-4 px-1 text-sm font-medium transition-all duration-200 
                                ${activeTab === 'settings' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            Paramètres
                        </button>
                        <button
                            className={`border-b-2 py-4 px-1 text-sm font-medium transition-all duration-200 
                                ${activeTab === 'support' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}
                            onClick={() => setActiveTab('support')}
                        >
                            Support
                        </button>
                    </nav>
                </div>

                {/* Contenu principal responsive */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {activeTab === 'communities' && (
                        <>
                            {/* Navigation des communautés (colonne de gauche) */}
                            <div className="space-y-4">
                                {isLoadingJoined ? (
                                    <div className="text-center py-4">
                                        <p>Chargement des communautés...</p>
                                    </div>
                                ) : joinedCommunities.map((community, index) => (
                                    <div
                                        key={index}
                                        className={`w-full bg-white rounded-lg p-4 hover:bg-gray-50 transition-all duration-200 ${selectedCommunity?.name === community.name
                                            ? 'ring-2 ring-blue-500 shadow-md'
                                            : 'border border-gray-200'
                                            }`}
                                    >
                                        <div className="flex flex-col space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div
                                                    onClick={() => setSelectedCommunity(community as unknown as UserCommunity)}
                                                    className="flex-1 cursor-pointer"
                                                >
                                                    <div className="font-medium text-gray-900">{community.name}</div>
                                                    <div className="text-sm text-gray-500 mt-1">
                                                        {community.role} • Depuis {community.createdAt}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => router.push(`/community/${community.id}`)}
                                                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    Accéder
                                                </button>
                                                {community.role === 'learner' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedCommunityForContribution(community.name);
                                                            setIsContributorModalOpen(true);
                                                        }}
                                                        className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-all duration-200"
                                                    >
                                                        Devenir contributeur
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full p-4 rounded-lg bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-2 group"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Rejoindre une nouvelle communauté</span>
                                </button>
                            </div>

                            {/* Contenu de la communauté sélectionnée (colonne centrale) */}
                            <div className="col-span-2 space-y-6">
                                {/* Mes enrichissements */}
                                <Card className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200">
                                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Mes enrichissements</h3>
                                    {enrichments && enrichments.length > 0 ? (
                                        <div className="space-y-4">
                                            {enrichments.map((enrichment, idx) => (
                                                <div key={idx} className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${enrichment.status === 'APPROVED'
                                                                ? 'bg-green-100 text-green-700'
                                                                : enrichment.status === 'PENDING'
                                                                    ? 'bg-yellow-100 text-yellow-700'
                                                                    : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                {enrichment.status === 'APPROVED'
                                                                    ? 'Approuvé'
                                                                    : enrichment.status === 'PENDING'
                                                                        ? 'En attente'
                                                                        : 'Rejeté'}
                                                            </span>
                                                            <h4 className="mt-2 font-medium text-gray-900">
                                                                Enrichissement pour: {enrichment.community_posts.title}
                                                            </h4>
                                                            <p className="mt-1 text-sm text-gray-600">{enrichment.description}</p>
                                                            <div className="flex items-center mt-2 text-sm text-gray-500">
                                                                <span>{formatDistanceToNow(new Date(enrichment.created_at), {
                                                                    addSuffix: true,
                                                                    locale: fr
                                                                })}</span>
                                                                <span className="mx-2">•</span>
                                                                <span>Communauté: {enrichment.community_posts.community.name}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => router.push(`/community/${enrichment.community_posts.community.id}/posts/${enrichment.community_posts.id}`)}
                                                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                                        >
                                                            Voir le post
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>Aucun enrichissement disponible.</p>
                                    )}
                                </Card>

                                {/* Mes posts */}
                                <Card className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200">
                                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Mes posts</h3>
                                    {selectedCommunityPosts && selectedCommunityPosts.length > 0 ? (
                                        <div className="space-y-4">
                                            {selectedCommunityPosts
                                                .map((post, idx) => (
                                                    <div key={idx} className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                                                        <h4 className="font-medium text-gray-900">{post.title}</h4>
                                                        <div className="flex items-center mt-2 text-sm text-gray-500">
                                                            <div dangerouslySetInnerHTML={{ __html: post.content.slice(0, 300) + '...' }} />
                                                            {formatDistanceToNow(new Date(post.created_at), {
                                                                addSuffix: true,
                                                                locale: fr
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    ) : (
                                        <p>Aucun post disponible.</p>
                                    )}
                                </Card>

                                {/* Revenus générés */}
                                <Card className="p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200">
                                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Revenus générés</h3>
                                    <div className="bg-gray-50 p-6 rounded-lg">
                                        <p className="text-3xl font-bold text-gray-900">{"0€"}</p>
                                        <p className="text-sm text-gray-500 mt-1">Revenus totaux de la communauté</p>
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}

                    {activeTab === 'my-community' && (
                        <div className="col-span-3">
                            {isLoading ? (
                                <div className="text-center py-12">
                                    <p>Chargement...</p>
                                </div>
                            ) : userOwnedCommunities.length > 0 ? (
                                <div className="space-y-8">
                                    {userOwnedCommunities.map((community) => (
                                        <Card key={community.id} className="p-6 bg-white rounded-xl shadow-md">
                                            <div className="flex flex-col">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="text-2xl font-bold text-gray-900">{community.name}</h3>
                                                    <div className="flex gap-4">
                                                        <button
                                                            onClick={() => router.push(`/community/${community.id}/dashboard`)}
                                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                        >
                                                            Tableau de bord
                                                        </button>
                                                        <button
                                                            onClick={() => router.push(`/community/${community.id}`)}
                                                            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                                        >
                                                            Accéder à la communauté
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-gray-600 mt-2 pr-2">{community.description}</p>

                                                {!community.isComplete && (
                                                    <div className="mt-6 space-y-4">
                                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                                            <h4 className="font-medium text-amber-800 mb-2">Actions recommandées</h4>
                                                            <ul className="space-y-2">
                                                                <li className="flex items-center text-amber-700">
                                                                    <ArrowRight className="w-4 h-4 mr-2" />
                                                                    Complétez la description de votre communauté
                                                                </li>
                                                                <li className="flex items-center text-amber-700">
                                                                    <ArrowRight className="w-4 h-4 mr-2" />
                                                                    Ajoutez une vidéo de présentation YouTube
                                                                </li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="mt-6 grid grid-cols-3 gap-6">
                                                    <div className="bg-gray-50 p-4 rounded-lg">
                                                        <Users className="w-6 h-6 text-blue-500 mb-2" />
                                                        <p className="text-2xl font-bold text-gray-900">{community.stats.membersCount}</p>
                                                        <p className="text-sm text-gray-600">Membres</p>
                                                    </div>
                                                    <div className="bg-gray-50 p-4 rounded-lg">
                                                        <MessageCircle className="w-6 h-6 text-green-500 mb-2" />
                                                        <p className="text-2xl font-bold text-gray-900">{community.stats.postsCount}</p>
                                                        <p className="text-sm text-gray-600">Posts</p>
                                                    </div>
                                                    <div className="bg-gray-50 p-4 rounded-lg">
                                                        <Wallet className="w-6 h-6 text-purple-500 mb-2" />
                                                        <p className="text-2xl font-bold text-gray-900">{community.stats.revenue}€</p>
                                                        <p className="text-sm text-gray-600">Revenus générés</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                    <Card className="p-6 bg-white rounded-xl shadow-md">
                                        <div className="text-center">
                                            <h3 className="text-xl font-bold text-gray-900 mb-4">Créer une autre communauté</h3>
                                            <p className="text-gray-600 mb-6">Développez votre présence avec une nouvelle communauté</p>
                                            <button
                                                onClick={() => router.push('/create-community')}
                                                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                                            >
                                                Créer une communauté
                                            </button>
                                        </div>
                                    </Card>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Créez votre propre communauté</h3>
                                    <p className="text-gray-600 mb-8">Lancez votre communauté et commencez à partager votre expertise</p>
                                    <button
                                        onClick={() => router.push('/create-community')}
                                        className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                                    >
                                        Créer une communauté
                                    </button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                                <Card className="p-6 bg-white rounded-xl shadow-md">
                                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Avantages</h4>
                                    <ul className="space-y-3">
                                        <li className="flex items-center gap-2 text-gray-600">
                                            <Check className="w-5 h-5 text-green-500" />
                                            Créez votre propre espace d&apos;échange
                                        </li>
                                        <li className="flex items-center gap-2 text-gray-600">
                                            <Check className="w-5 h-5 text-green-500" />
                                            Monétisez votre expertise
                                        </li>
                                        <li className="flex items-center gap-2 text-gray-600">
                                            <Check className="w-5 h-5 text-green-500" />
                                            Construisez une communauté active
                                        </li>
                                    </ul>
                                </Card>
                                <Card className="p-6 bg-white rounded-xl shadow-md">
                                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Fonctionnalités</h4>
                                    <ul className="space-y-3">
                                        <li className="flex items-center gap-2 text-gray-600">
                                            <Check className="w-5 h-5 text-green-500" />
                                            Outils de modération avancés
                                        </li>
                                        <li className="flex items-center gap-2 text-gray-600">
                                            <Check className="w-5 h-5 text-green-500" />
                                            Analyses et statistiques
                                        </li>
                                        <li className="flex items-center gap-2 text-gray-600">
                                            <Check className="w-5 h-5 text-green-500" />
                                            Personnalisation complète
                                        </li>
                                    </ul>
                                </Card>


                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="col-span-3">
                            <Card className="p-6 bg-white rounded-xl shadow-md">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-semibold text-gray-900">Informations du compte</h3>
                                </div>
                                <div className="space-y-4">
                                    {/* Photo de profil */}
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full overflow-hidden">
                                                <Image
                                                    src={previewUrl || userData.avatar}
                                                    alt="Profile"
                                                    className="w-full h-full object-cover"
                                                    width={48}
                                                    height={48}
                                                />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Photo de profil</p>
                                            </div>
                                        </div>
                                        {isEditing === 'avatar' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleAvatarChange}
                                                    className="text-sm"
                                                />
                                                <button
                                                    onClick={() => handleSubmit('avatar')}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
                                                >
                                                    Enregistrer
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(null)}
                                                    className="px-3 py-1 text-gray-600 text-sm"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditing('avatar')}
                                                className="text-blue-600 text-sm hover:text-blue-700"
                                            >
                                                Modifier
                                            </button>
                                        )}
                                    </div>

                                    {/* Nom complet */}
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <User className="w-5 h-5 text-gray-500" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Nom complet</p>
                                                <p className="text-sm text-gray-500">{userData.fullName}</p>
                                            </div>
                                        </div>
                                        {isEditing === 'fullName' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    name="fullName"
                                                    value={formData.fullName}
                                                    onChange={handleInputChange}
                                                    className="px-2 py-1 border rounded"
                                                />
                                                <button
                                                    onClick={() => handleSubmit('fullName')}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
                                                >
                                                    Enregistrer
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(null)}
                                                    className="px-3 py-1 text-gray-600 text-sm"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditing('fullName')}
                                                className="text-blue-600 text-sm hover:text-blue-700"
                                            >
                                                Modifier
                                            </button>
                                        )}
                                    </div>

                                    {/* Nom d'utilisateur */}
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <AtSign className="w-5 h-5 text-gray-500" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Nom d&apos;utilisateur</p>
                                                <p className="text-sm text-gray-500">{userData.userName}</p>
                                            </div>
                                        </div>
                                        {isEditing === 'userName' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    name="userName"
                                                    value={formData.userName}
                                                    onChange={handleInputChange}
                                                    className="px-2 py-1 border rounded"
                                                />
                                                <button
                                                    onClick={() => handleSubmit('userName')}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
                                                >
                                                    Enregistrer
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(null)}
                                                    className="px-3 py-1 text-gray-600 text-sm"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditing('userName')}
                                                className="text-blue-600 text-sm hover:text-blue-700"
                                            >
                                                Modifier
                                            </button>
                                        )}
                                    </div>

                                    {/* Email */}
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Mail className="w-5 h-5 text-gray-500" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Email</p>
                                                <p className="text-sm text-gray-500">{userData.email}</p>
                                            </div>
                                        </div>
                                        {isEditing === 'email' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    className="px-2 py-1 border rounded"
                                                />
                                                <button
                                                    onClick={() => handleSubmit('email')}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
                                                >
                                                    Enregistrer
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(null)}
                                                    className="px-3 py-1 text-gray-600 text-sm"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditing('email')}
                                                className="text-blue-600 text-sm hover:text-blue-700"
                                            >
                                                Modifier
                                            </button>
                                        )}
                                    </div>

                                    {/* Mot de passe */}
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Lock className="w-5 h-5 text-gray-500" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Mot de passe</p>
                                                <p className="text-sm text-gray-500">••••••••</p>
                                            </div>
                                        </div>
                                        {isEditing === 'password' ? (
                                            <div className="flex flex-col gap-2 w-64">
                                                <input
                                                    type="password"
                                                    name="currentPassword"
                                                    placeholder="Mot de passe actuel"
                                                    value={formData.currentPassword}
                                                    onChange={handleInputChange}
                                                    className="px-2 py-1 border rounded text-sm"
                                                />
                                                <input
                                                    type="password"
                                                    name="newPassword"
                                                    placeholder="Nouveau mot de passe"
                                                    value={formData.newPassword}
                                                    onChange={handleInputChange}
                                                    className="px-2 py-1 border rounded text-sm"
                                                />
                                                <input
                                                    type="password"
                                                    name="confirmPassword"
                                                    placeholder="Confirmer le mot de passe"
                                                    value={formData.confirmPassword}
                                                    onChange={handleInputChange}
                                                    className="px-2 py-1 border rounded text-sm"
                                                />
                                                <div className="flex justify-end gap-2 mt-2">
                                                    <button
                                                        onClick={() => handleSubmit('password')}
                                                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm"
                                                    >
                                                        Enregistrer
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditing(null)}
                                                        className="px-3 py-1 text-gray-600 text-sm"
                                                    >
                                                        Annuler
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditing('password')}
                                                className="text-blue-600 text-sm hover:text-blue-700"
                                            >
                                                Modifier
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                            {/* Abonnements */}
                            <Card className="p-6 mt-6 bg-white rounded-xl shadow-md">
                                <h3 className="text-xl font-semibold text-gray-900 mb-6">Mes abonnements</h3>
                                <div className="space-y-4">
                                    {userOwnedCommunities.map((community, index) => (
                                        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-medium text-gray-900">{community.name}</h4>
                                                    <p className="text-sm text-gray-500">
                                                        {"Membre actif" === "Membre actif"
                                                            ? "Abonnement Premium - Accès illimité"
                                                            : "Abonnement Standard"}
                                                    </p>
                                                </div>
                                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                                    Actif
                                                </span>
                                            </div>
                                            <div className="mt-4 space-y-3">
                                                <div className="flex justify-between items-center text-sm text-gray-500">
                                                    <span>Prix mensuel</span>
                                                    <span className="font-medium text-gray-900">29,99€</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm text-gray-500">
                                                    <span>Prochain paiement</span>
                                                    <span>15 avril 2024</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm text-gray-500">
                                                    <span>Statut</span>
                                                    <span className="text-green-600">Actif</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                                                <div className="flex space-x-2">
                                                    <button onClick={() => toast.info("Cette fonctionnalité n'est pas encore définie")} className="text-blue-600 text-sm hover:text-blue-700 font-medium">
                                                        Changer de formule
                                                    </button>
                                                    <span className="text-gray-300">|</span>
                                                    <button onClick={() => toast.info("Cette fonctionnalité n'est pas encore définie")} className="text-red-600 text-sm hover:text-red-700 font-medium">
                                                        Résilier
                                                    </button>
                                                </div>
                                                <button onClick={() => toast.info("Cette fonctionnalité n'est pas encore définie")} className="text-gray-600 text-sm hover:text-gray-700 font-medium">
                                                    Voir les détails
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Section pour les offres disponibles */}
                                    <div className="mt-8">
                                        <h4 className="text-lg font-medium text-gray-900 mb-4">Offres disponibles</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h5 className="font-medium text-blue-900">Pack Découverte</h5>
                                                        <p className="text-sm text-blue-700">Accès à 3 communautés</p>
                                                    </div>
                                                    <span className="text-lg font-bold text-blue-900">49,99€/mois</span>
                                                </div>
                                                <button onClick={() => toast.info("Cette fonctionnalité n'est pas encore définie")} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                                    Choisir cette offre
                                                </button>
                                            </div>

                                            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h5 className="font-medium text-purple-900">Pack Expert</h5>
                                                        <p className="text-sm text-purple-700">Accès illimité</p>
                                                    </div>
                                                    <span className="text-lg font-bold text-purple-900">89,99€/mois</span>
                                                </div>
                                                <button onClick={() => toast.info("Cette fonctionnalité n'est pas encore définie")} className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                                    Choisir cette offre
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'support' && (
                        <div className="col-span-3">
                            <Card className="p-6 bg-white rounded-xl shadow-md">
                                <h3 className="text-xl font-semibold text-gray-900 mb-6">Support et Aide</h3>
                                <div className="space-y-3">
                                    <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                                        <div onClick={() => toast.info("Cette fonctionnalité n'est pas encore définie")} className="flex items-center gap-3">
                                            <HelpCircle className="w-5 h-5 text-gray-500" />
                                            <span className="text-sm font-medium text-gray-900">Centre d&apos;aide</span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button onClick={() => toast.info("Cette fonctionnalité n'est pas encore définie")} className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <MessageSquare className="w-5 h-5 text-gray-500" />
                                            <span className="text-sm font-medium text-gray-900">Contacter le support</span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button onClick={() => toast.info("Cette fonctionnalité n'est pas encore définie")} className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-gray-500" />
                                            <span className="text-sm font-medium text-gray-900">FAQ</span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>

                {/* Modal de candidature */}
                <Dialog
                    open={isContributorModalOpen}
                    onClose={() => setIsContributorModalOpen(false)}
                    className="relative z-50"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                            {/* En-tête du modal avec dégradé */}
                            <div className="bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#003E8A] to-[#16215B] p-6">
                                <div className="flex justify-between items-start">
                                    <div className="text-white">
                                        <h3 className="text-xl font-bold">
                                            Devenir contributeur pour {selectedCommunityForContribution}
                                        </h3>
                                        <p className="mt-2 text-white/80">
                                            Partagez votre expertise et gagnez des récompenses en contribuant à la communauté
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsContributorModalOpen(false)}
                                        className="text-white/80 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6">
                                {/* Avantages */}
                                <div className="grid grid-cols-3 gap-4 mb-8">
                                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl text-center">
                                        <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Trophy className="w-6 h-6 text-amber-600" />
                                        </div>
                                        <h4 className="font-medium text-amber-900 mb-1">Expertise Reconnue</h4>
                                        <p className="text-xs text-amber-700">Gagnez en visibilité dans la communauté</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl text-center">
                                        <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <DollarSign className="w-6 h-6 text-green-600" />
                                        </div>
                                        <h4 className="font-medium text-green-900 mb-1">Récompenses</h4>
                                        <p className="text-xs text-green-700">Monétisez vos contributions</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl text-center">
                                        <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Users className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <h4 className="font-medium text-blue-900 mb-1">Communauté</h4>
                                        <p className="text-xs text-blue-700">Rejoignez un réseau d&apos;experts</p>
                                    </div>
                                </div>

                                {/* Formulaire */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Pourquoi souhaitez-vous devenir contributeur ?
                                        </label>
                                        <textarea
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                                            rows={4}
                                            placeholder="Partagez votre motivation et votre expertise..."
                                            value={justification}
                                            onChange={(e) => setJustification(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Vos domaines d&apos;expertise
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                            placeholder="Ex: Trading, Analyse technique, DeFi..."
                                            value={expertiseDomain}
                                            onChange={(e) => setExpertiseDomain(e.target.value)}
                                        />
                                    </div>
                                    {submitError && (
                                        <div className="text-red-600 text-sm">
                                            {submitError}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer avec actions */}
                            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-4">
                                <button
                                    onClick={() => setIsContributorModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleContributorRequest}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Envoi en cours...' : 'Envoyer ma candidature'}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Dialog>
            </div>
        </div>
    );
};

export default ProfilePage; 