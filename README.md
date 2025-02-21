# Snowledgeball 🌨️

> Plateforme de partage de connaissances permettant aux experts de créer des communautés d'apprentissage et de monétiser leur expertise.

## Aperçu rapide

- 🎯 **Objectif** : Faciliter le partage de connaissances et la monétisation d'expertise
- 🛠️ **Stack** : Next.js 14, TypeScript, Prisma, PostgreSQL, Starknet
- 🔒 **Sécurité** : NextAuth, CSRF Protection
- 📱 **Interface** : Responsive, TailwindCSS, TinyMCE

## Démarrage rapide

1. Cloner le projet : git clone [url-du-repo]
2. Installer les dépendances : npm install dans /frontend
3. Configurer les variables d'environnement : copier .env.example vers .env.local
4. Lancer le projet : npm run dev

## Variables d'environnement nécessaires

- NEXT_PUBLIC_GATEWAY_URL
- NEXT_PUBLIC_TINYMCE_API_KEY
- NEXTAUTH_SECRET
- NEXTAUTH_URL
- DATABASE_URL
- PINATA_API_KEY
- PINATA_SECRET_KEY

## Structure du projet

frontend/
- app/ : Pages et routes
- components/ : Composants React
- lib/ : Configurations et utilitaires
- public/ : Assets statiques

## Fonctionnalités principales

### Créateurs
- ✨ Création de communautés
- 📊 Dashboard analytique
- 💰 Monétisation
- 👥 Gestion des contributeurs

### Apprenants
- 🔍 Découverte de communautés
- 📚 Accès aux contenus
- 💬 Discussions
- 📈 Progression

## Stack technique

### Frontend
- Next.js 14
- TypeScript
- TailwindCSS
- TinyMCE
- Sonner

### Backend
- Prisma
- PostgreSQL
- NextAuth
- IPFS (Pinata)

### Web3
- Starknet
- Starknet.js

## License

MIT
