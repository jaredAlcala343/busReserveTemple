/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para compatibilidad
  experimental: {
    // Si necesitas mantener el middleware
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Deshabilitar telemetría si quieres
  telemetry: false,
  // Configuración de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig