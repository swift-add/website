"use client";

import React, { useState, useEffect } from "react";
import { connectFreighter, getStellarPublicKey, isFreighterInstalled } from "@/lib/stellarWallet";

interface StellarWalletButtonProps {
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
  className?: string;
}

export default function StellarWalletButton({
  onConnect,
  onDisconnect,
  className = "",
}: StellarWalletButtonProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freighterInstalled, setFreighterInstalled] = useState(false);

  // Check if Freighter is installed on component mount
  useEffect(() => {
    checkFreighterInstallation();
    checkExistingConnection();
  }, []);

  const checkFreighterInstallation = async () => {
    const installed = await isFreighterInstalled();
    setFreighterInstalled(installed);
  };

  const checkExistingConnection = async () => {
    try {
      const key = await getStellarPublicKey();
      if (key) {
        setPublicKey(key);
        setIsConnected(true);
        if (onConnect) {
          onConnect(key);
        }
      }
    } catch (error) {
      console.error("No existing connection found");
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    const result = await connectFreighter();

    if (result.success && result.publicKey) {
      setIsConnected(true);
      setPublicKey(result.publicKey);
      if (onConnect) {
        onConnect(result.publicKey);
      }
    } else {
      setError(result.error || "Failed to connect");
    }

    setIsLoading(false);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setPublicKey(null);
    if (onDisconnect) {
      onDisconnect();
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!freighterInstalled) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <button
          className="px-4 py-2 bg-gray-500 text-white rounded cursor-not-allowed opacity-50"
          disabled
        >
          Freighter Not Installed
        </button>
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-500 hover:text-blue-600 underline text-center"
        >
          Install Freighter Wallet
        </a>
      </div>
    );
  }

  if (isConnected && publicKey) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-green-500 text-white rounded flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            <span>{truncateAddress(publicKey)}</span>
          </div>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none focus:ring-offset-2"
            aria-label="Disconnect Stellar wallet"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        onClick={handleConnect}
        disabled={isLoading}
        aria-label="Connect Stellar wallet"
        className={`px-4 py-2 text-white rounded transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-offset-2 ${isLoading

            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-600"
          }`}
      >
        {isLoading ? "Connecting..." : "Connect Stellar Wallet"}
      </button>
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}