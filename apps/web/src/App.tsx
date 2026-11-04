import type React from "react";
import { Route, Routes } from "react-router-dom";
import { RequireLogin } from "./components/Bits";
import { Layout } from "./components/Layout";
import { AdminPage } from "./pages/Admin";
import { CharacterPage } from "./pages/Character";
import { ConnectPage } from "./pages/Connect";
import { DeedPage } from "./pages/Deed";
import { DiscoveriesPage } from "./pages/Discoveries";
import { HomePage } from "./pages/Home";
import { PrivacyPage, TermsPage } from "./pages/Legal";
import { LoginPage } from "./pages/Login";
import { MePage } from "./pages/Me";
import { MirrorPage } from "./pages/Mirror";
import { NewStepPage } from "./pages/NewStep";
import { NotificationsPage } from "./pages/Notifications";
import { PlacePage } from "./pages/Place";
import { ProviderPage } from "./pages/Provider";
import { StepsPage } from "./pages/Steps";
import { TrialPage } from "./pages/Trial";

const guard = (el: React.ReactElement) => <RequireLogin>{el}</RequireLogin>;

export function App() {
  return (
    <Layout>
      <Routes>
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
      </Routes>
    </Layout>
  );
}
