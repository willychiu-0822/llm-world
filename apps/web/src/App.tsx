import { lazy, Suspense, type ReactElement } from "react";
import { Route, Routes } from "react-router-dom";
import { Loading, RequireLogin } from "./components/Bits";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/Home";
import { PrivacyPage, TermsPage } from "./pages/Legal";
import { LoginPage } from "./pages/Login";

const AdminPage = lazy(() => import("./pages/Admin").then(m => ({ default: m.AdminPage })));
const CharacterPage = lazy(() => import("./pages/Character").then(m => ({ default: m.CharacterPage })));
const ConnectPage = lazy(() => import("./pages/Connect").then(m => ({ default: m.ConnectPage })));
const DeedPage = lazy(() => import("./pages/Deed").then(m => ({ default: m.DeedPage })));
const DiscoveriesPage = lazy(() => import("./pages/Discoveries").then(m => ({ default: m.DiscoveriesPage })));
const MePage = lazy(() => import("./pages/Me").then(m => ({ default: m.MePage })));
const MirrorPage = lazy(() => import("./pages/Mirror").then(m => ({ default: m.MirrorPage })));
const NewStepPage = lazy(() => import("./pages/NewStep").then(m => ({ default: m.NewStepPage })));
const NotificationsPage = lazy(() => import("./pages/Notifications").then(m => ({ default: m.NotificationsPage })));
const PlacePage = lazy(() => import("./pages/Place").then(m => ({ default: m.PlacePage })));
const ProviderPage = lazy(() => import("./pages/Provider").then(m => ({ default: m.ProviderPage })));
const StepsPage = lazy(() => import("./pages/Steps").then(m => ({ default: m.StepsPage })));
const TrialPage = lazy(() => import("./pages/Trial").then(m => ({ default: m.TrialPage })));

const guard = (el: ReactElement) => <RequireLogin>{el}</RequireLogin>;

export function App() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}><Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/places/:id" element={<PlacePage />} />
        <Route path="/deeds/:id" element={<DeedPage />} />
        <Route path="/trials/:id" element={<TrialPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/me" element={guard(<MePage />)} />
        <Route path="/me/character" element={guard(<CharacterPage />)} />
        <Route path="/connect" element={guard(<ConnectPage />)} />
        <Route path="/discoveries" element={guard(<DiscoveriesPage />)} />
        <Route path="/steps" element={guard(<StepsPage />)} />
        <Route path="/steps/new" element={guard(<NewStepPage />)} />
        <Route path="/mirror" element={guard(<MirrorPage />)} />
        <Route path="/notifications" element={guard(<NotificationsPage />)} />
        <Route path="/provider" element={guard(<ProviderPage />)} />
        <Route path="/admin" element={guard(<AdminPage />)} />
        <Route path="*" element={<p className="empty">這條路還沒蓋好。回到<a href="/">地圖</a>看看吧。</p>} />
      </Routes></Suspense>
    </Layout>
  );
}
