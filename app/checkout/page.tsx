// pages/checkout/index.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as StellarSdk from 'stellar-sdk';
import { getAddress, signTransaction, isConnected, setAllowed } from '@stellar/freighter-api';
import { toast } from 'sonner'; // 🎉 ADDED TOAST

const WalletIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrophyIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

interface ConnectionStatus {
  type: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

interface PaymentInfo {
  slotId: string;
  price: string;
  size: string;
  durations: string[];
  category: string;
}

interface QueuedAd {
  position: number;
  bidAmount: string;
  startsAt: string;
  expiresAt: string;
}

interface QueueInfo {
  slotId: string;
  position: number;
  totalInQueue: number;
  nextActivation?: string;
  isAvailable: boolean;
  minimumBid: string;
  currentAd?: {
    expiresAt: string;
    timeRemaining: number;
  };
  queueInfo?: QueuedAd[];
}

// Stellar configuration
const STELLAR_RECIPIENT = 'GD3CBC4DDBHVP2W67P3I67SORRCWMNZAGGEGXON3JX25WPU7Q2OUH4LN';
const STELLAR_NETWORK = 'TESTNET';

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ type: 'idle', message: '' });
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [isBidding, setIsBidding] = useState<boolean>(false);
  const [stellarAddress, setStellarAddress] = useState<string>('');
  const [isStellarConnected, setIsStellarConnected] = useState(false);

  // 🎯 ADDED: View-to-Earn Credits State
  const [userCredits, setUserCredits] = useState<string>('0');
  const [appliedDiscount, setAppliedDiscount] = useState<string>('0');
  const [finalBidAmount, setFinalBidAmount] = useState<string>('');

  // Parse payment information from URL parameters
  useEffect(() => {
    const slotId = searchParams.get('slotId');
    const price = searchParams.get('price');
    const size = searchParams.get('size');
    const durations = searchParams.get('durations')?.split(',') || [];
    const category = searchParams.get('category') || 'general';

    if (slotId && price && size) {
      setPaymentInfo({
        slotId,
        price,
        size,
        durations,
        category
      });
      
      setBidAmount(price);
      setFinalBidAmount(price);
      fetchQueueInfo(slotId);
    }
  }, [searchParams]);

  // 🎯 ADDED: Auto-apply discount when bidAmount changes
  useEffect(() => {
    if (isStellarConnected && parseFloat(userCredits) > 0) {
      applyDiscount(userCredits, bidAmount);
    } else {
      setFinalBidAmount(bidAmount);
    }
  }, [bidAmount, userCredits, isStellarConnected]);

  // Check if Freighter is installed on mount
  useEffect(() => {
    checkFreighterInstalled();
  }, []);

  const checkFreighterInstalled = async () => {
    try {
      const result = await isConnected();
      console.log('Freighter check:', result);
    } catch (error) {
      console.error('Freighter not found:', error);
      setConnectionStatus({ 
        type: 'error', 
        message: 'Please install Freighter wallet extension' 
      });
      toast.error('Freighter Wallet Not Found', {
        description: 'Please install Freighter wallet extension to continue'
      });
    }
  };

  const claimPendingCredits = async (walletAddress: string) => {
  try {
    const sessionId = localStorage.getItem('ad_session_id');
    if (!sessionId) {
      console.log('ℹ️ No session ID found, skipping credit claim');
      return;
    }

    console.log('🔗 Attempting to claim pending credits for session:', sessionId);
    
    const response = await fetch('/api/claim-credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        walletAddress: walletAddress
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Claim result:', data);
      
      if (data.creditsClaimed > 0) {
        toast.success('🎉 Previous Credits Claimed!', {
          description: `Claimed ${data.creditsClaimed} XLM from ${data.viewsClaimed} ad views!`,
          duration: 5000,
        });
      }
    }
  } catch (error) {
    console.error('❌ Error claiming credits:', error);
  }
};


  const fetchQueueInfo = async (slotId: string) => {
    try {
      const response = await fetch(`/api/queue-info/${slotId}`);
      if (response.ok) {
        const queueData = await response.json();
        setQueueInfo(queueData);
        setIsBidding(!queueData.isAvailable);
        
        // Set minimum bid if slot is occupied
        if (!queueData.isAvailable && queueData.minimumBid) {
          setBidAmount(queueData.minimumBid);
          toast.info('Slot Occupied', {
            description: `Minimum bid: ${queueData.minimumBid} XLM to join queue`,
            duration: 4000
          });
        }
      }
    } catch (error) {
      console.error('Error fetching queue info:', error);
    }
  };

  // 🎯 ADDED: Fetch user credits
  const fetchUserCredits = async (walletAddress: string) => {
    try {
      console.log('💰 Fetching credits for:', walletAddress);
      const response = await fetch(`/api/credits/${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        setUserCredits(data.credits);
        
        // 🎉 TOAST: Credits found
        if (parseFloat(data.credits) > 0) {
          toast.success('💰 View-to-Earn Credits Found!', {
            description: `You have ${data.credits} XLM in credits available!`,
            duration: 5000,
          });
        }
        
        console.log(`✅ User has ${data.credits} XLM in credits`);
        applyDiscount(data.credits, bidAmount);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      toast.error('Failed to Load Credits', {
        description: 'Could not fetch your View-to-Earn credits'
      });
    }
  };

  const applyDiscount = (credits: string, currentBid: string) => {
    const creditsNum = parseFloat(credits);
    const bidNum = parseFloat(currentBid);
    
    if (creditsNum > 0 && bidNum > 0) {
      // Maximum discount allowed is 50% of the bid
      const maxDiscount = bidNum * 0.5;
      
      // Use ALL available credits, but don't exceed 50% of bid
      const discount = Math.min(creditsNum, maxDiscount);
      
      // Final amount must be at least 0.01 XLM
      const finalAmount = Math.max(0.01, bidNum - discount);
      
      setAppliedDiscount(discount.toFixed(2));
      setFinalBidAmount(finalAmount.toFixed(2));
      
      // 🎉 TOAST: Discount applied
      if (discount > 0) {
        toast.success('🎉 Discount Applied!', {
          description: `You saved ${discount.toFixed(2)} XLM! Pay only ${finalAmount.toFixed(2)} XLM`,
          duration: 5000,
        });
      }
      
      console.log(`💰 Credits available: ${creditsNum.toFixed(2)} XLM`);
      console.log(`💰 Max discount (50% of ${bidNum}): ${maxDiscount.toFixed(2)} XLM`);
      console.log(`💰 Discount applied: ${discount.toFixed(2)} XLM`);
      console.log(`💰 Final amount: ${finalAmount.toFixed(2)} XLM`);
    } else {
      setAppliedDiscount('0');
      setFinalBidAmount(currentBid);
    }
  };

  const formatTimeRemaining = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDisconnect = () => {
    setIsStellarConnected(false);
    setStellarAddress('');
    setUserCredits('0');
    setAppliedDiscount('0');
    setFinalBidAmount(bidAmount);
    setConnectionStatus({ type: 'idle', message: '' });
    toast.info('Wallet Disconnected');
  };

  const connectStellar = async () => {
  try {
    console.log('Attempting to connect to Freighter...');
    setConnectionStatus({ type: 'loading', message: 'Connecting to Freighter...' });
    
    await setAllowed();
    console.log('Permission granted');
    
    const result = await getAddress();
    console.log('Address result:', result);
    
    if (result && result.address) {
      setStellarAddress(result.address);
      setIsStellarConnected(true);
      
      // 🎯 SAVE TO LOCALSTORAGE
      localStorage.setItem('stellar_wallet_address', result.address);
      
      setConnectionStatus({ type: 'success', message: 'Connected successfully!' });
      
      // 🎯 CLAIM PENDING CREDITS FIRST
      await claimPendingCredits(result.address);
      
      // 🎯 THEN FETCH TOTAL CREDITS (now includes claimed credits!)
      await fetchUserCredits(result.address);
      
      setTimeout(() => setConnectionStatus({ type: 'idle', message: '' }), 2000);
    } else {
      throw new Error('No address returned from Freighter');
    }
  } catch (error: any) {
    console.error('Stellar connection error:', error);
    setConnectionStatus({ 
      type: 'error', 
      message: error.message || 'Failed to connect Freighter wallet. Make sure it is installed and unlocked.' 
    });
    toast.error('Connection Failed', {
      description: error.message || 'Could not connect to Freighter wallet'
    });
  }
};

  const handleStellarPayment = async () => {
    if (!stellarAddress || !paymentInfo) return;
    
    try {
      setConnectionStatus({ type: 'loading', message: 'Preparing Stellar payment...' });
      
      // 🎯 UPDATED: Use final bid amount (after discount)
      const paymentAmount = finalBidAmount || bidAmount;
      const originalBidAmount = bidAmount;
      const discountUsed = appliedDiscount;
      
      const server = new StellarSdk.Horizon.Server(
        STELLAR_NETWORK === 'TESTNET' 
          ? 'https://horizon-testnet.stellar.org' 
          : 'https://horizon.stellar.org'
      );
      
      console.log('Loading account:', stellarAddress);
      const account = await server.loadAccount(stellarAddress);
      
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: STELLAR_NETWORK === 'TESTNET' 
          ? StellarSdk.Networks.TESTNET 
          : StellarSdk.Networks.PUBLIC
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: STELLAR_RECIPIENT,
            asset: StellarSdk.Asset.native(),
            amount: paymentAmount
          })
        )
        // 🎯 UPDATED: Include discount in memo
        .addMemo(StellarSdk.Memo.text(`SwiftAd:${paymentInfo.slotId}:${discountUsed}`))
        .setTimeout(180)
        .build();
      
      setConnectionStatus({ type: 'loading', message: 'Please sign in Freighter...' });
      
      console.log('Requesting signature...');
      const signResult = await signTransaction(transaction.toXDR(), {
        networkPassphrase: STELLAR_NETWORK === 'TESTNET' 
          ? StellarSdk.Networks.TESTNET 
          : StellarSdk.Networks.PUBLIC
      });
      
      console.log('Sign result:', signResult);
      
      if (signResult && signResult.signedTxXdr) {
        setConnectionStatus({ type: 'loading', message: 'Submitting transaction...' });
        
        const signedTx = StellarSdk.TransactionBuilder.fromXDR(
          signResult.signedTxXdr,
          STELLAR_NETWORK === 'TESTNET' ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC
        ) as StellarSdk.Transaction;
        
        console.log('Submitting to Horizon...');
        const result = await server.submitTransaction(signedTx);
        console.log('Transaction result:', result);
        
        // Record payment
        try {
          await fetch('/api/record-stellar-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactionHash: result.hash,
              slotId: paymentInfo.slotId,
              amount: paymentAmount,
              originalBid: originalBidAmount,
              discountApplied: discountUsed,
              asset: 'XLM',
              network: STELLAR_NETWORK.toLowerCase(),
              from: stellarAddress,
              to: STELLAR_RECIPIENT,
              memo: `SwiftAd:${paymentInfo.slotId}:${discountUsed}`,
              ledger: result.ledger,
              timestamp: new Date().toISOString(),
              isBid: isBidding
            })
          });
        } catch (apiError) {
          console.error('Failed to record payment:', apiError);
        }
        
        setConnectionStatus({ 
          type: 'success', 
          message: 'Payment successful! Redirecting to upload...' 
        });
        
        // 🎉 TOAST: Payment successful
        toast.success('🚀 Payment Successful!', {
          description: parseFloat(discountUsed) > 0 
            ? `Paid ${paymentAmount} XLM (saved ${discountUsed} XLM!)` 
            : `Paid ${paymentAmount} XLM`,
          duration: 5000,
        });
        
        const paymentData = {
          index: paymentInfo.slotId,
          validUpto: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          txHash: result.hash,
          AmountPaid: paymentAmount,
          bidAmount: originalBidAmount,
          discountApplied: discountUsed,
          payerAddress: stellarAddress,
          recieverAddress: STELLAR_RECIPIENT
        };

        sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
        
        setTimeout(() => {
          // 🎯 UPDATED: Include all payment details in redirect
          router.push(
            `/upload?slotId=${paymentInfo.slotId}` +
            `&price=${paymentInfo.price}` +
            `&bidAmount=${originalBidAmount}` +
            `&finalAmount=${paymentAmount}` +
            `&discountApplied=${discountUsed}` +
            `&size=${paymentInfo.size}` +
            `&category=${paymentInfo.category}` +
            `&transactionHash=${result.hash}` +
            `&walletAddress=${stellarAddress}` +
            `&network=${STELLAR_NETWORK}`
          );
        }, 2000);
      } else {
        throw new Error('Transaction signing failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setConnectionStatus({ 
        type: 'error', 
        message: error.message || 'Payment failed. Please try again.' 
      });
      toast.error('Payment Failed', {
        description: error.message || 'Transaction could not be completed'
      });
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const renderConnectionStatus = () => {
    if (connectionStatus.type === 'idle') return null;

    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {connectionStatus.type === 'loading' && (
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            )}
            {connectionStatus.type === 'success' && (
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            )}
            {connectionStatus.type === 'error' && (
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            )}
            <p className="text-sm text-gray-700">{connectionStatus.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            aria-label="Go back"
            className="mb-4 -ml-4 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Checkout
          </h1>
          <p className="text-gray-600 text-sm">
            Pay with Stellar (XLM)
          </p>
        </div>

        {paymentInfo && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {paymentInfo.price} XLM
                </div>
                <div className="text-sm text-gray-600">
                  {paymentInfo.slotId} • {paymentInfo.size}
                </div>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Slot:</span>
                  <span className="text-gray-900 font-medium">{paymentInfo.slotId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Size:</span>
                  <span className="text-gray-900 font-medium">{paymentInfo.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Network:</span>
                  <span className="text-gray-900 font-medium">Stellar {STELLAR_NETWORK}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {queueInfo && !queueInfo.isAvailable && (
          <Card
            className="mb-6 border-yellow-500 bg-yellow-50"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Queue position information"
          >
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <ClockIcon className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="font-semibold text-yellow-700 text-sm mb-2">
                  Slot Currently Occupied
                </h3>
                <div className="space-y-2 text-xs text-yellow-700">
                  {queueInfo.currentAd && (
                    <div className="flex justify-between px-4">
                      <span>Current ad expires:</span>
                      <span className="font-bold">
                        {formatTimeRemaining(queueInfo.currentAd.timeRemaining)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between px-4">
                    <span>Ads in queue:</span>
                    <span className="font-bold" aria-live="polite" aria-atomic="true">{queueInfo.totalInQueue}</span>
                  </div>
                  <div className="flex justify-between px-4">
                    <span>Minimum bid:</span>
                    <span className="font-bold">{queueInfo.minimumBid} XLM</span>
                  </div>
                </div>
              </div>

              {queueInfo.queueInfo && queueInfo.queueInfo.length > 0 && (
                <div className="mt-4 pt-4 border-t border-yellow-300">
                  <div className="flex items-center gap-2 mb-3">
                    <TrophyIcon className="w-4 h-4 text-yellow-600" />
                    <h4 className="text-xs font-semibold text-yellow-700">
                      Current Queue (Sorted by Bid)
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {queueInfo.queueInfo.slice(0, 3).map((ad, index) => (
                      <div 
                        key={index}
                        className="flex justify-between items-center text-xs bg-yellow-100 p-2 rounded"
                      >
                        <span className="text-yellow-700">
                          #{ad.position} - {ad.bidAmount} XLM
                        </span>
                        <span className="text-yellow-600 text-[10px]">
                          Starts: {formatDateTime(ad.startsAt)}
                        </span>
                      </div>
                    ))}
                    {queueInfo.queueInfo.length > 3 && (
                      <p className="text-xs text-yellow-600 text-center">
                        +{queueInfo.queueInfo.length - 3} more in queue
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 🎯 ADDED: Credits Display Card */}
        {isStellarConnected && parseFloat(userCredits) > 0 && (
          <Card className="mb-6 border-green-500 bg-green-50">
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="font-semibold text-green-700 text-sm mb-2">
                  🎉 View-to-Earn Credits Available!
                </h3>
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {userCredits} XLM
                </div>
                {parseFloat(appliedDiscount) > 0 && (
                  <div className="space-y-1 text-xs text-green-700">
                    <div className="flex justify-between items-center px-4">
                      <span>Original Bid:</span>
                      <span className="line-through">{bidAmount} XLM</span>
                    </div>
                    <div className="flex justify-between items-center px-4">
                      <span>Discount:</span>
                      <span className="font-bold">-{appliedDiscount} XLM</span>
                    </div>
                    <div className="flex justify-between items-center px-4 pt-2 border-t border-green-300">
                      <span className="font-bold">You Pay:</span>
                      <span className="font-bold text-lg">{finalBidAmount} XLM</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-green-600 mt-3">
                  Earned by viewing ads on this site!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {paymentInfo && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">
                    {isBidding ? 'Bid Amount' : 'Purchase Amount'}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {isBidding 
                      ? 'Higher bids get priority in the queue' 
                      : 'Slot is available for immediate purchase'
                    }
                  </p>
                  {/* 🎯 ADDED: Discount indicator */}
                  {parseFloat(appliedDiscount) > 0 && (
                    <div className="bg-green-100 border border-green-300 rounded p-2 mb-3">
                      <p className="text-xs text-green-700">
                        💰 {appliedDiscount} XLM discount will be applied!
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bidAmount" className="text-sm font-medium text-gray-900">
                    Amount (XLM)
                  </Label>
                  <div className="relative">
                    <Input
                      id="bidAmount"
                      type="number"
                      step="0.01"
                      min={paymentInfo.price}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="pr-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={paymentInfo.price}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                      XLM
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Minimum: {paymentInfo.price} XLM
                    {isBidding && queueInfo && ` • Suggested: ${queueInfo.minimumBid} XLM`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="p-6">
            {!isStellarConnected ? (
              <div className="text-center">
                <WalletIcon className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4 text-sm">
                  Connect your Freighter wallet to continue
                </p>
                <Button 
                  onClick={connectStellar} 
                  aria-label="Connect Stellar wallet"
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                  disabled={connectionStatus.type === 'loading'}
                >
                  {connectionStatus.type === 'loading' ? 'Connecting...' : 'Connect Stellar Wallet'}
                </Button>
                <p className="text-xs text-gray-500 mt-4">
                  Don't have Freighter? <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">Install it here</a>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Freighter Connected</p>
                      <p className="text-xs text-gray-600">
                        {formatAddress(stellarAddress)}
                      </p>
                    </div>
                  </div>
                </div>

                {paymentInfo && (
                  <div className="space-y-3">
                    <Button
                      onClick={handleStellarPayment}
                      aria-label="Book advertising slot"
                      aria-describedby="slot-description"
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white h-12 font-medium"
                      disabled={connectionStatus.type === 'loading'}
                    >
                      {/* 🎯 UPDATED: Show discount in button */}
                      {connectionStatus.type === 'loading' 
                        ? 'Processing...' 
                        : isBidding 
                          ? parseFloat(appliedDiscount) > 0
                            ? `Bid ${finalBidAmount} XLM (${appliedDiscount} XLM discount)`
                            : `Bid ${bidAmount} XLM`
                          : parseFloat(appliedDiscount) > 0
                            ? `Pay ${finalBidAmount} XLM (${appliedDiscount} XLM discount)`
                            : `Pay ${bidAmount} XLM`
                      }
                    </Button>
                    
                    <Button
                      onClick={handleDisconnect}
                      variant="outline"
                      aria-label="Disconnect Stellar wallet"
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Disconnect Wallet
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {renderConnectionStatus()}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}