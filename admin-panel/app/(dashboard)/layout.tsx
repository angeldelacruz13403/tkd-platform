"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { RetrainModal } from "@/components/RetrainModal";
import { AIRetrainMetrics } from "@/lib/types";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isRetrainOpen, setIsRetrainOpen] = useState(false);
  const [metrics, setMetrics] = useState<AIRetrainMetrics>({
    modelVersion: "v2.4-olympic-adaptive",
    trainedAt: new Date().toISOString(),
    datasetSizeRecords: 14850,
    heartRateSessionsAnalyzed: 1840,
    combatRoundsProcessed: 4320,
    fatiguePredictionAccuracy: 95.2,
    tacticalRecommendationF1: 92.4,
    learnedWeights: {
      cardioVolumeTolerance: 1.18,
      anaerobicRecoveryRate: 0.94,
      gamJeomRiskWeight: 1.35,
      round3FatigueDecayFactor: 0.88,
    },
    changelog: "Ajuste del coeficiente de degradación física en asalto 3 y control de Z5.",
  });

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex h-screen flex-col bg-[#06090f] overflow-hidden md:flex-row">
          {/* Left Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
            <Header onTriggerRetrain={() => setIsRetrainOpen(true)} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          </div>

          {/* Retrain AI Interactive Modal */}
          <RetrainModal
            isOpen={isRetrainOpen}
            onClose={() => setIsRetrainOpen(false)}
            currentMetrics={metrics}
            onRetrainComplete={(updated) => setMetrics(updated)}
          />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
