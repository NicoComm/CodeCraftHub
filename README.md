# CodeCraftHub

## Ejecutar la aplicación

La aplicación usa Vite para servir el frontend y un servidor Express para la API.
Desde la carpeta del proyecto, instala las dependencias una vez:

```bash
npm install
```

Inicia la API en una terminal:

```bash
npm run server
```

Inicia el frontend en otra terminal:

```bash
npm run dev
```

Abre en el navegador la dirección que muestre Vite (normalmente
`http://localhost:5173`).

La API está configurada en `http://localhost:5000/api/courses`. El servidor
Express debe estar en ejecución tanto si sirves el frontend con Vite como con
Live Server. Live Server puede mostrar la interfaz, pero no inicia la API.