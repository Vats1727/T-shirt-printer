# T-Shirt Printer Platform

A full-stack custom apparel design and fulfillment platform built with **React.js** (Frontend) and **Node.js + Express.js** (Backend) in **100% Pure JavaScript** using a professional **MVC (Model-View-Controller)** architecture.

---

## 📁 Project Architecture

```
Tshirt-printer/
│
├── client/                             # React.js Frontend (Pure JS / JSX)
│   ├── public/                         # Public static files
│   ├── src/
│   │   ├── assets/                     # Global assets & illustrations
│   │   ├── components/
│   │   │   ├── common/                 # Shared domain components (DesignCanvas, SavedDesignCard)
│   │   │   └── ui/                     # UI component primitives (buttons, dialogs, inputs)
│   │   ├── layouts/                    # Application layouts (DashboardLayout, AppSidebar, Header, Footer)
│   │   ├── pages/                      # Feature pages organized by domain
│   │   │   ├── Home/                   # Landing page
│   │   │   ├── NotFound/               # 404 handler
│   │   │   ├── Auth/                   # Login & Register
│   │   │   ├── Admin/                  # Print Provider Dashboard, Inventory, Orders
│   │   │   ├── Supplier/               # Designer/Supplier Dashboard, Listings, Saved Designs
│   │   │   ├── Portal/                 # Portal Admin Provider Management
│   │   │   └── Store/                  # Public Designer Storefront & Product Viewer
│   │   ├── routes/                     # Router & Route Guards (AppRoutes, AdminRoute, SupplierRoute)
│   │   ├── services/                   # Centralized API service (api.js, auth.js)
│   │   ├── hooks/                      # Custom hooks (useToast, useMobile, useDesigns)
│   │   ├── context/                    # React Contexts (AuthContext, LoadingContext)
│   │   ├── utils/                      # Helper utilities (cn, idEncoder)
│   │   ├── constants/                  # Roles, statuses, enums
│   │   ├── App.jsx                     # Root application shell
│   │   ├── main.jsx                    # React DOM entry point
│   │   └── index.css                   # Global styles & Tailwind CSS
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                             # Node.js + Express Backend (Pure JS)
│   ├── src/
│   │   ├── config/                     # Database & environment configuration
│   │   │   ├── database.js             # PostgreSQL connection pool & Drizzle ORM
│   │   │   └── env.js                  # Environment variables & defaults
│   │   ├── models/                     # Data Access Layer / SQL queries
│   │   │   ├── user.model.js           # Users & authentication records
│   │   │   ├── product.model.js        # Products, colors, sizes, size charts
│   │   │   ├── inventory.model.js      # Cloth inventory
│   │   │   ├── order.model.js          # Orders & order lines
│   │   │   ├── design.model.js         # Designs & design versions
│   │   │   ├── asset.model.js          # Assets & media tracking
│   │   │   └── listing.model.js        # Supplier storefront listings
│   │   ├── controllers/                # Request validation & HTTP responses
│   │   │   ├── auth.controller.js
│   │   │   ├── user.controller.js
│   │   │   ├── portal.controller.js
│   │   │   ├── design.controller.js
│   │   │   ├── product.controller.js
│   │   │   ├── order.controller.js
│   │   │   ├── supplier.controller.js
│   │   │   └── asset.controller.js
│   │   ├── services/                   # Business logic layer
│   │   │   ├── auth.service.js
│   │   │   ├── user.service.js
│   │   │   ├── order.service.js
│   │   │   └── storage.service.js
│   │   ├── routes/                     # Modular API route definitions
│   │   │   ├── index.js                # Master route aggregator (/api)
│   │   │   ├── auth.routes.js
│   │   │   ├── portal.routes.js
│   │   │   ├── design.routes.js
│   │   │   ├── product.routes.js
│   │   │   ├── supplier.routes.js
│   │   │   └── asset.routes.js
│   │   ├── middleware/                 # Express middleware
│   │   │   ├── auth.middleware.js      # JWT authentication & requireRole guard
│   │   │   ├── error.middleware.js     # Centralized error handler
│   │   │   └── not-found.middleware.js # 404 API handler
│   │   ├── utils/                      # Utilities (logger.js, idEncoder.js)
│   │   ├── constants/                  # Constants (roles.js)
│   │   ├── app.js                      # Express application setup
│   │   └── server.js                   # Server bootstrap & listener
│   ├── migrations/                     # SQL database migrations
│   ├── uploads/                        # Static uploads directory
│   ├── .env.example
│   ├── index.js                        # Root entry delegating to src/server.js
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### 1. Start Development Server (Backend)
```bash
# In server directory:
cd server
npm run dev      # Runs with Node watch: node --watch src/server.js
```

### 2. Start Development Client (Frontend)
```bash
# In client directory:
cd client
npm run dev      # Runs Vite dev server on http://localhost:5173
```

---

## 🔐 Default Credentials
* **Portal Admin:** `portaladmin@gmail.com` / `123456`
* **Supplier:** `supplier@gmail.com`
* **Admin:** `admin@gmail.com`