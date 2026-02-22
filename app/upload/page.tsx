// pages/upload/index.tsx
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Simple SVG icons
const CloudUploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
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

const ImageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

interface UploadStatus {
  type: 'idle' | 'uploading' | 'storing' | 'success' | 'error';
  message: string;
  progress?: number;
}

interface PaymentInfo {
  slotId: string;
  price: string;
  size: string;
  durations: string[];
  category: string;
}

interface PaymentData {
  index: string;
  validUpto: number;
  txHash: string;
  AmountPaid: string;
  bidAmount?: string;
  payerAddress: string;
  recieverAddress: string;
}

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ type: 'idle', message: '' });
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lighthouseHash, setLighthouseHash] = useState<string | null>(null);

  // Load payment data from URL parameters or session storage
  useEffect(() => {
    // First try to get from URL parameters (from checkout redirect)
    const slotId = searchParams.get('slotId');
    const price = searchParams.get('price');
    const bidAmount = searchParams.get('bidAmount');
    const size = searchParams.get('size');
    const category = searchParams.get('category');
    const transactionHash = searchParams.get('transactionHash');
    const walletAddress = searchParams.get('walletAddress');
    const network = searchParams.get('network');

    if (slotId && price && size && walletAddress) {
      // Create payment data from URL parameters
      const validUpto = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      setPaymentData({
        index: `${slotId}-${Date.now()}`,
        validUpto,
        txHash: transactionHash || `pending-${Date.now()}`,
        AmountPaid: bidAmount || price,
        bidAmount: bidAmount || undefined,
        payerAddress: walletAddress,
        recieverAddress: 'GD3CBC4DDBHVP2W67P3I67SORRCWMNZAGGEGXON3JX25WPU7Q2OUH4LN' // Your recipient address
      });

      setPaymentInfo({
        slotId,
        price,
        size,
        durations: ['1h'],
        category: category || 'general'
      });

      console.log('Payment data loaded from URL:', {
        slotId,
        price,
        bidAmount,
        walletAddress,
        transactionHash
      });
    } else {
      // Fall back to session storage
      const storedPaymentData = sessionStorage.getItem('paymentData');
      const storedPaymentInfo = sessionStorage.getItem('paymentInfo');

      if (storedPaymentData && storedPaymentInfo) {
        setPaymentData(JSON.parse(storedPaymentData));
        setPaymentInfo(JSON.parse(storedPaymentInfo));
        console.log('Payment data loaded from session storage');
      } else {
        console.warn('No payment data found. Redirecting to home...');
        setTimeout(() => router.push('/blog'), 3000);
      }
    }
  }, [router, searchParams]);

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadStatus({ type: 'error', message: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadStatus({ type: 'error', message: 'File size must be less than 5MB' });
      return;
    }

    setSelectedFile(file);
    setUploadStatus({ type: 'idle', message: '' });

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  // Upload via backend API (fixed version)
  const uploadViaBackend = async (file: File): Promise<string> => {
    if (!paymentData || !paymentInfo) {
      throw new Error('Payment data not available');
    }

    const formData = new FormData();
    formData.append('slotId', paymentInfo.slotId);
    formData.append('advertiserWallet', paymentData.payerAddress);
    formData.append('contentType', 'image');
    formData.append('clickUrl', 'https://example.com');
    formData.append('description', `Ad for slot ${paymentInfo.slotId}`);
    formData.append('duration', '1h');
    formData.append('price', paymentInfo.price);
    formData.append('paymentHash', paymentData.txHash);
    formData.append('adFile', file);

    console.log('Uploading via backend API...');
    
    const response = await fetch('/api/ad-submissions', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const result = await response.json();
    console.log('Backend upload result:', result);
    
    // Return the IPFS hash
    return result.submission.fileUpload.hash;
  };

  // Store ad record in database
  const storeAdRecord = async (mediaHash: string): Promise<void> => {
    if (!paymentData || !paymentInfo) throw new Error('Payment data not available');

    const adRecord = {
      slotId: paymentInfo.slotId,
      mediaHash: mediaHash,
      paymentData: paymentData,
      paymentInfo: paymentInfo
    };

    console.log('Storing ad record:', adRecord);

    const response = await fetch('/api/upload-ad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adRecord)
    });

    if (!response.ok) {
      throw new Error('Failed to store ad record');
    }

    const result = await response.json();
    console.log('Ad record stored:', result);
  };

  // Main upload handler
  const handleUpload = async () => {
    if (!selectedFile || !paymentData || !paymentInfo) return;

    try {
      setUploadStatus({ type: 'uploading', message: 'Uploading to IPFS...', progress: 30 });

      const hash = await uploadViaBackend(selectedFile);
      setLighthouseHash(hash);

      setUploadStatus({ type: 'storing', message: 'Storing ad record...', progress: 70 });

      await storeAdRecord(hash);

      setUploadStatus({ type: 'success', message: 'Ad uploaded successfully!', progress: 100 });

      setTimeout(() => {
        router.push('/');
      }, 3000);

      sessionStorage.removeItem('paymentData');
      sessionStorage.removeItem('paymentInfo');

    } catch (error: any) {
      console.error('Upload failed:', error);
      setUploadStatus({ 
        type: 'error', 
        message: error.message || 'Upload failed. Please try again.' 
      });
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const event = { target: { files: [file] } } as any;
      handleFileSelect(event);
    }
  };

  const renderUploadStatus = () => {
    if (uploadStatus.type === 'idle') return null;

    const statusConfig = {
      uploading: { icon: CloudUploadIcon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
      storing: { icon: CloudUploadIcon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
      success: { icon: CheckCircleIcon, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
      error: { icon: ExclamationTriangleIcon, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
    };

    const config = statusConfig[uploadStatus.type];
    const Icon = config.icon;

    return (
      <div className={`rounded-2xl border-2 ${config.border} ${config.bg} p-6`}>
        <div className="flex items-center gap-3 mb-3">
          <Icon className={`w-6 h-6 ${config.color}`} />
          <p className="text-sm font-semibold text-gray-900">{uploadStatus.message}</p>
        </div>
        {uploadStatus.progress !== undefined && (
          <Progress value={uploadStatus.progress} className="h-2" />
        )}
        {uploadStatus.type === 'success' && lighthouseHash && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700">IPFS Hash:</p>
            <p className="text-xs break-all text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-200">{lighthouseHash}</p>
            <a
              href={`https://gateway.lighthouse.storage/ipfs/${lighthouseHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
            >
              View on IPFS Gateway →
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            aria-label="Go back"
            className="mb-6 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
            Upload Your Ad
          </h1>
          <p className="text-lg text-gray-600">
            Upload your advertisement image to IPFS
          </p>
        </div>

        {paymentInfo && paymentData && (
          <div className="mb-8 bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Payment Confirmed</h3>
                <p className="text-sm text-gray-600">
                  Your payment has been processed. Upload your ad to complete.
                </p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Slot</span>
                <span className="text-sm font-semibold text-gray-900">{paymentInfo.slotId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Size</span>
                <Badge variant="outline" className="rounded-lg">{paymentInfo.size}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Amount</span>
                <span className="text-sm font-semibold text-gray-900">{paymentData.AmountPaid} XLM</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">TX Hash</span>
                <span className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">{paymentData.txHash.slice(0, 16)}...</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8">
            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all cursor-pointer p-12 text-center rounded-xl bg-gray-50/50"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <CloudUploadIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-700 text-base font-semibold mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-gray-500 text-sm">
                    Image files only (max 5MB)
                  </p>
                </label>
              </div>
            ) : (
              <div className="space-y-6">
                {previewUrl && (
                  <div className="relative rounded-xl overflow-hidden border-2 border-gray-100">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-64 object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                      <ImageIcon className="w-5 h-5 text-gray-700" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-600">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setUploadStatus({ type: 'idle', message: '' });
                    }}
                    variant="outline"
                    size="sm"
                    aria-label="Remove selected file"
                    className="rounded-lg border-gray-200 hover:bg-gray-50"
                  >
                    Remove
                  </Button>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploadStatus.type === 'uploading' || uploadStatus.type === 'storing' || !paymentData}
                  aria-label="Upload advertisement to IPFS"
                  className="w-full bg-black hover:bg-gray-800 text-white font-semibold h-12 rounded-lg text-base shadow-sm"
                >
                  {uploadStatus.type === 'uploading' || uploadStatus.type === 'storing'
                    ? 'Uploading...'
                    : 'Upload to IPFS'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {renderUploadStatus()}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-2 border-black border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading upload page...</p>
        </div>
      </div>
    }>
      <UploadPageContent />
    </Suspense>
  );
}