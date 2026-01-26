import { useState, useEffect } from "react";
import { Link } from "react-router";
import { toast } from "react-toastify";
import type { RouteType, SavedRouteData } from "../../types";
import StaticRouteMap from "./StaticRouteMap";

interface SavedRoute {
  id: number;
  user_id: number;
  name: string;
  route: SavedRouteData;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  uuid: string;
}

interface PaginatedRoutesResponse {
  routes: SavedRoute[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export default function Profile() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 9; // 3x3 grid

  useEffect(() => {
    fetchRoutes(currentPage);
  }, [currentPage]);

  const fetchRoutes = async (page: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/routes?page=${page}&limit=${limit}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch routes");
      }

      const data: PaginatedRoutesResponse = await response.json();
      setRoutes(data.routes);
      setTotalPages(data.total_pages);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching routes:", error);
      toast.error("Erreur lors du chargement des itinéraires");
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading && routes.length === 0) {
    return (
      <div className="profile-container">
        <h1>Mes Itinéraires</h1>
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h1>Mes Itinéraires</h1>

      {routes.length === 0 ? (
        <div className="no-routes">
          <p>Vous n'avez pas encore d'itinéraires enregistrés.</p>
          <Link to="/plan" className="btn btn-primary">
            Créer un itinéraire
          </Link>
        </div>
      ) : (
        <>
          <div className="routes-grid">
            {routes.map((route) => (
              <Link
                key={route.uuid}
                to={`/plan/${route.uuid}`}
                className="route-card"
              >
                <div className="route-info">
                  <h3>{route.name}</h3>
                  <p className="route-date">
                    Modifié le {formatDate(route.updated_at)}
                  </p>
                </div>
                <div className="route-map">
                  {route.route?.apiResponse ? (
                    <StaticRouteMap route={route.route.apiResponse} />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--color-muted)",
                        color: "var(--color-muted-foreground)",
                      }}
                    >
                      Carte non disponible
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="btn btn-secondary"
              >
                ← Précédent
              </button>
              <span className="page-info">
                Page {currentPage} sur {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || loading}
                className="btn btn-secondary"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
