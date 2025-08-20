## 📚 Proyecto Backend – Biblioteca SPA

Este es el backend de la aplicación SPA de biblioteca personal. Fue desarrollado con Node.js 18 utilizando el framework Molecular y conectado a MongoDB para el manejo de datos persistentes.

El proyecto integra la API pública de Open Library
 para la búsqueda de libros y complementa esta información con los registros almacenados en la base de datos local.

##  🚀 Funcionalidades principales

El backend expone varios endpoints que permiten:

    #🔎 Buscar libros en Open Library (GET /api/books/search?q=:nombreDelLibro).
    #🕑 Consultar las últimas búsquedas realizadas (GET /api/books/last-search).
    #📥 Guardar libros en “mi biblioteca” junto con su portada en base64 (POST /api/books/my-library).
    #📖 Consultar la información de un libro específico desde “mi biblioteca” (GET /api/books/my-library/:id).
    #✏️ Actualizar reseñas y calificaciones de un libro guardado (PUT /api/books/my-library/:id).
    #❌ Eliminar libros de “mi biblioteca” (DELETE /api/books/my-library/:id).

##  🐳 Docker y ejecución

El proyecto incluye su configuración de Dockerfile y docker-compose.yml, para simplificar la ejecución del entorno de desarrollo.

Arrancar el proyecto
- `$env:NODE_ENV="development"; $env:BUILD_TARGET="dev"`
- `docker compose up -d --build`
- `docker compose logs -f app   # ver logs en tiempo real`

Detener el proyecto
- `docker compose down`
