# ============================================
# BUILD STAGE
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copier package files
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Build l'app React
RUN npm run build

# ============================================
# PRODUCTION STAGE
# ============================================
FROM nginx:alpine

# Copier les fichiers build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier la config nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]