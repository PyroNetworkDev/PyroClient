# 🚀 Miguelki Network MC Launcher

<p align="center">
  <img src="src/assets/images/icon.png" alt="Miguelki Network MC Launcher" width="128" height="128">
</p>

<p align="center">
  <strong>Launcher de Minecraft moderno y potente para los servidores de Miguelki Network</strong>
</p>

<p align="center">
  <a href="https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/releases/latest">
    <img src="https://img.shields.io/github/v/release/miguelkix30/MiguelkiNetworkMCLauncher?style=for-the-badge&logo=github&logoColor=white" alt="Latest Release">
  </a>
  <a href="https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/releases">
    <img src="https://img.shields.io/github/downloads/miguelkix30/MiguelkiNetworkMCLauncher/total?style=for-the-badge&logo=github&logoColor=white" alt="Total Downloads">
  </a>
  <a href="https://dsc.gg/miguelkinetwork">
    <img src="https://img.shields.io/discord/1300477405957329018?style=for-the-badge&logo=discord&logoColor=white&label=Discord" alt="Discord">
  </a>
</p>

<p align="center">
  <a href="https://nodejs.org">
    <img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  </a>
  <a href="https://electronjs.org">
    <img src="https://img.shields.io/badge/Electron-36.5+-blue?style=for-the-badge&logo=electron&logoColor=white" alt="Electron">
  </a>
</p>

---

## 📋 Tabla de Contenidos

- [🎯 Características](#-características)
- [📦 Descargas](#-descargas)
- [🔧 Instalación](#-instalación)
- [🛠️ Desarrollo](#️-desarrollo)
- [📄 Licencia](#-licencia)
- [🤝 Contribuir](#-contribuir)
- [📞 Soporte](#-soporte)
- [📊 Estadísticas](#-estadísticas)
- [🌟 ¿Te gusta el proyecto?](#-te-gusta-el-proyecto)
- [🎮 Compatibilidad de Loaders](#-compatibilidad-de-loaders)

---

## 🎯 Características

### 🎮 **Gestión de Juego**
- ✅ Soporte completo para **Vanilla, Forge, NeoForge, Fabric y Quilt**
- ✅ Descarga automática de **Java** (8, 17, 21)
- ✅ Gestión inteligente de **mods y recursos**
- ✅ **Perfiles múltiples** con configuraciones independientes
- ✅ **Actualizaciones automáticas** del launcher

### 🔐 **Autenticación**
- ✅ **Inicio de sesión con Microsoft (premium) u Offline (no premium)**
- ✅ **Discord OAuth2** para la verificación de usuarios

### 🎨 **Interfaz Moderna**

---

## 📦 Descargas

### 📥 **Descarga Rápida**

| Sistema Operativo | Descarga Directa | Requisitos |
|:----------------:|:----------------:|:----------:|
| **Windows x64** | [📥 Descargar](https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/releases/latest/download/Miguelki-Network-MC-Launcher-win-x64.exe) | Windows 10+ |
| **macOS Universal** | [📥 Descargar](https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/releases/latest/download/Miguelki-Network-MC-Launcher-mac-universal.zip) | macOS 10.15+ |
| **Linux x64** | [📥 Descargar](https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/releases/latest/download/Miguelki-Network-MC-Launcher-linux-x86_64.AppImage) | Ubuntu 18.04+ |

### 🔄 **Otras Opciones**
- 📋 [**Todas las releases**](https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/releases) - Versiones anteriores y beta

---

## 🔧 Instalación

### Windows
1. Descarga el archivo `.exe`
2. Ejecuta como administrador
3. Sigue el asistente de instalación
4. ¡Listo para usar!

### macOS
1. Descarga el archivo `.zip`
2. Extrae el contenido
3. Arrastra la aplicación a `/Applications`
4. Ejecuta la aplicación

### Linux
1. Descarga el archivo `.AppImage`
2. Dale permisos de ejecución: `chmod +x *.AppImage`
3. Ejecuta el archivo: `./Miguelki-Network-MC-Launcher-linux-x86_64.AppImage`

---

## 🛠️ Desarrollo

### 📋 **Requisitos de Desarrollo**
- **Node.js** 18 o superior
- **npm** o **yarn**
- **Git**

### 🏗️ **Compilación**
```bash
# Clonar el repositorio
git clone https://github.com/miguelkix30/MiguelkiNetworkMCLauncher.git
cd MiguelkiNetworkMCLauncher

# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Compilar para producción
npm run build
```

### 🧪 **Scripts Disponibles**
```bash
npm run start      # Ejecutar en modo desarrollo
npm run dev        # Desarrollo con hot-reload
npm run build      # Compilar aplicación
npm run icon       # Generar iconos
```

### 🔧 **Herramientas de Desarrollo**
- **Verificador de Compatibilidad**: `node run-loader-check.js`
- **Configurar Dependencias**: `node setup-loader-checker.js`
- **Diagnósticos**: Incluido en el launcher

---

## 📄 Licencia

Este proyecto está bajo la **Licencia CCANC** (Creative Commons Attribution-NonCommercial).

### 📜 **Condiciones de Uso**
- ✅ **Uso personal** y educativo
- ✅ **Modificación** con atribución
- ✅ **Distribución** con créditos
- ❌ **Uso comercial** sin autorización

### 🤝 **Atribución Requerida**
Si utilizas este código, debes dar crédito a:
- **Miguelki** (Autor de este fork)
- **Luuxis** (Autor original de [Selvania Launcher](https://github.com/luuxis/Selvania-Launcher))

---

## 🤝 Contribuir

### 🎯 **Cómo Contribuir**
1. 🍴 Fork el repositorio
2. 🌿 Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. 📝 Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. 📤 Push a la rama (`git push origin feature/AmazingFeature`)
5. 🔄 Abre un Pull Request

### 📋 **Directrices**
- 🧪 Incluye tests para nuevas funcionalidades
- 📖 Actualiza la documentación
- 🎨 Sigue las convenciones de código
- 🔍 Verifica que no haya errores

### 🏆 **Contribuidores**
¡Gracias a todos los que han contribuido a este proyecto!

---

## 📞 Soporte

### 🆘 **Obtener Ayuda**
- 💬 **Discord**: [Miguelki Network](https://dsc.gg/miguelkinetwork)
- 🐛 **Issues**: [GitHub Issues](https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/issues)

### 🔧 **Resolución de Problemas**
- 📋 Revisa la [wiki](https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/wiki)
- 🔍 Busca en [issues cerrados](https://github.com/miguelkix30/MiguelkiNetworkMCLauncher/issues?q=is%3Aissue+is%3Aclosed)
- 🆘 Únete a nuestro Discord para ayuda en tiempo real

### ⚠️ **Importante**
- 🚫 **No se proporciona soporte** para repositorios fork
- 📜 **Bloqueo de acceso al servidor**: La ejecución de este launcher en el entorno de desarrollo y su conexión a los servidores de producción provocará un bloqueo permanente del dispositivo a dichos servidores. 
- 🔒 **Protección de datos**: Se recopilan datos básicos del sistema para seguridad, entre ellos están:
        - 🆔 **Nombre de usuario**
        - 🖥️ **Sistema Operativo**
        - 🧠 **Identificador de hardware (HWID)**
        - 📦 **Versión del launcher**
        - 🌐 **IP pública**
- 📞 **Contacto**: Para eliminación de datos, contacta por Discord

---

## 📊 Estadísticas

<p align="center">
  <img src="https://github-readme-stats.vercel.app/api?username=miguelkix30&show_icons=true&theme=dark" alt="GitHub Stats">
</p>

---

## 🌟 ¿Te gusta el proyecto?

Si este launcher te ha sido útil, considera:
- ⭐ **Darle una estrella** en GitHub
- 🔄 **Compartirlo** con tus amigos
- 💬 **Unirte** a nuestra comunidad de Discord
- 🐛 **Reportar bugs** para mejorar la experiencia

---

<p align="center">
  <strong>Hecho con ❤️ por <a href="https://github.com/miguelkix30">Miguelki</a></strong>
</p>

<p align="center">
  <sub>Basado en el excelente trabajo de <a href="https://github.com/luuxis">Luuxis</a></sub>
</p>

<details>
<summary>📖 Ver reporte completo de compatibilidad</summary>

Para ver el reporte detallado con la matriz completa de compatibilidad, consulta el archivo [`loader-compatibility-report.md`](./loader-compatibility-report.md).

</details>

## 🎮 Compatibilidad de Loaders

> **Última actualización:** 13 de julio de 2025  
> **Total de pruebas:** 330 | **Exitosas:** 180 (54.5%)

### 📊 Resumen por Loader

| Loader | Compatibilidad | Versiones Soportadas |
|--------|----------------|---------------------|
| **VANILLA** | 84.8% | 56/66 |
| **FORGE** | 65.2% | 43/66 |
| **NEOFORGE** | 10.6% | 7/66 |
| **FABRIC** | 59.1% | 39/66 |
| **QUILT** | 53.0% | 35/66 |

### 🎮 Tabla Completa de Compatibilidad por Versión

| Versión | Vanilla | Forge | NeoForge | Fabric | Quilt | Total Compatible |
|---------|---------|-------|----------|--------|-------|------------------|
| 1.8 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.1 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.2 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.3 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.4 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.5 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.6 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.7 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.8 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.8.9 | ❌ | ❌ | ❌ | ❌ | ❌ | 0/5 | |
| 1.9 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.9.1 | ✅ | ❌ | ❌ | ❌ | ❌ | 1/5 | |
| 1.9.2 | ✅ | ❌ | ❌ | ❌ | ❌ | 1/5 | |
| 1.9.3 | ✅ | ❌ | ❌ | ❌ | ❌ | 1/5 | |
| 1.9.4 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.10 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.10.1 | ✅ | ❌ | ❌ | ❌ | ❌ | 1/5 | |
| 1.10.2 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.11 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.11.1 | ✅ | ❌ | ❌ | ❌ | ❌ | 1/5 | |
| 1.11.2 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.12 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.12.1 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.12.2 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.13 | ✅ | ❌ | ❌ | ❌ | ❌ | 1/5 | |
| 1.13.1 | ✅ | ❌ | ❌ | ❌ | ❌ | 1/5 | |
| 1.13.2 | ✅ | ✅ | ❌ | ❌ | ❌ | 2/5 | |
| 1.14 | ✅ | ❌ | ❌ | ✅ | ❌ | 2/5 | |
| 1.14.1 | ✅ | ❌ | ❌ | ✅ | ❌ | 2/5 | |
| 1.14.2 | ✅ | ✅ | ❌ | ✅ | ❌ | 3/5 | |
| 1.14.3 | ✅ | ✅ | ❌ | ✅ | ❌ | 3/5 | |
| 1.14.4 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.15 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.15.1 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.15.2 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.16 | ✅ | ❌ | ❌ | ✅ | ✅ | 3/5 | |
| 1.16.1 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.16.2 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.16.3 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.16.4 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.16.5 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.17 | ✅ | ❌ | ❌ | ✅ | ✅ | 3/5 | |
| 1.17.1 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.18 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.18.1 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.18.2 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.19 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.19.1 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.19.2 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.19.3 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.19.4 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.20 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.20.1 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.20.2 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 | |
| 1.20.3 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.20.4 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 | |
| 1.20.5 | ✅ | ❌ | ❌ | ✅ | ✅ | 3/5 | |
| 1.20.6 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 | |
| 1.21 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.21.1 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 | |
| 1.21.2 | ✅ | ❌ | ❌ | ✅ | ✅ | 3/5 | |
| 1.21.3 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 | |
| 1.21.4 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 | |
| 1.21.5 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 | |
| 1.21.6 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |
| 1.21.7 | ✅ | ✅ | ❌ | ✅ | ✅ | 4/5 | |


### 🔗 Enlaces Útiles

- [📄 Reporte Completo de Compatibilidad](loader-compatibility-report.md)

---