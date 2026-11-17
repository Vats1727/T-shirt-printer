import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  CreditCard,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Lock
} from 'lucide-react';

export default function GatewaySetupModal({
  isOpen,
  onClose,
  onSuccess,
  currentGateway = null,
  token
}) {
  const { toast } = useToast();

  const [envMode, setEnvMode] = useState('test');
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedWhSec, setCopiedWhSec] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Always reset fields to clean empty strings whenever the modal is opened
  useEffect(() => {
    if (isOpen) {
      setKeyId('');
      setKeySecret('');
      setWebhookSecret('');
      setShowSecret(false);
      setErrorMsg('');
      setEnvMode(currentGateway?.environmentMode || 'test');
    }
  }, [isOpen, currentGateway]);

  const webhookUrl = currentGateway?.webhookUrl || (
    currentGateway?.webhookUrlSlug
      ? `${window.location.origin}/api/webhooks/razorpay/providers/${currentGateway.webhookUrlSlug}`
      : `${window.location.origin}/api/webhooks/razorpay/providers/my-account`
  );

  function copyToClipboard(text, setCopied) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied to clipboard',
      description: text.slice(0, 40) + (text.length > 40 ? '...' : '')
    });
  }

  async function handleConnect(e) {
    e?.preventDefault();
    setErrorMsg('');

    if (!keyId.trim()) {
      setErrorMsg('Please enter your Razorpay Key ID.');
      return;
    }
    if (!keySecret.trim()) {
      setErrorMsg('Please enter your Razorpay Key Secret.');
      return;
    }

    if (envMode === 'test' && !keyId.trim().startsWith('rzp_test_')) {
      setErrorMsg("In Test Mode, your Key ID must start with 'rzp_test_'.");
      return;
    }
    if (envMode === 'live' && !keyId.trim().startsWith('rzp_live_')) {
      setErrorMsg("In Live Mode, your Key ID must start with 'rzp_live_'.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/provider/gateway/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          keyId: keyId.trim(),
          keySecret: keySecret.trim(),
          webhookSecret: webhookSecret.trim() || undefined,
          environmentMode: envMode
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to configure payment gateway.');
      }

      toast({
        title: 'Razorpay Gateway Connected',
        description: 'Live handshake verified successfully! You can now accept customer orders directly.'
      });

      if (onSuccess) {
        onSuccess(data.gateway);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Connection failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Connect Razorpay Merchant Gateway
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Customer payments route directly to your Razorpay account. No platform commission deductions on order funds.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleConnect} className="space-y-4 pt-2" autoComplete="off">
          {/* Decoy hidden inputs to prevent Chrome / Edge password manager heuristics */}
          <input type="text" name="fake_username_prevent_autofill" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
          <input type="password" name="fake_password_prevent_autofill" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="new-password" />

          {/* Environment Mode Switch */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-800">Environment Mode</p>
              <p className="text-[11px] text-slate-500">
                Use Test Mode for sandbox orders, Live Mode for real customer payments.
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setEnvMode('test')}
                className={`px-3 py-1 rounded-md transition-all ${
                  envMode === 'test'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Test
              </button>
              <button
                type="button"
                onClick={() => setEnvMode('live')}
                className={`px-3 py-1 rounded-md transition-all ${
                  envMode === 'live'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live
              </button>
            </div>
          </div>

          {/* Key ID Field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-slate-700">
                Razorpay Key ID <span className="text-rose-500">*</span>
              </Label>
              <span className="text-[10px] text-slate-400 font-mono">
                {envMode === 'test' ? 'Starts with rzp_test_' : 'Starts with rzp_live_'}
              </span>
            </div>
            <Input
              type="text"
              name="merchant_rzp_key_id"
              id="merchant_rzp_key_id"
              autoComplete="one-time-code"
              data-lpignore="true"
              data-1p-ignore="true"
              placeholder={envMode === 'test' ? 'rzp_test_...' : 'rzp_live_...'}
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              className="font-mono text-xs h-9 rounded-lg"
              required
            />
          </div>

          {/* Key Secret Field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-slate-700">
                Razorpay Key Secret <span className="text-rose-500">*</span>
              </Label>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" />
                Encrypted with AES-256-GCM
              </span>
            </div>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                name="merchant_rzp_key_secret"
                id="merchant_rzp_key_secret"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder="••••••••••••••••••••••••"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                className="font-mono text-xs h-9 pr-10 rounded-lg"
                required
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Webhook Configuration Guide */}
          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-blue-900 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Webhook Setup (Required for Payment Confirmation)
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Add this webhook endpoint in your Razorpay Dashboard (Settings → Webhooks) to enable automated order fulfillment:
            </p>

            <div className="space-y-1">
              <Label className="text-[10px] text-blue-800 font-medium">Your Dedicated Webhook URL</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-white text-[11px] font-mono h-8 border-blue-200 text-slate-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
                  className="h-8 px-2.5 border-blue-200 bg-white hover:bg-blue-50 text-blue-700 shrink-0"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-blue-800 font-medium">
                Webhook Secret (Copy to Razorpay Dashboard)
              </Label>
              <Input
                type="text"
                name="merchant_rzp_webhook_secret"
                id="merchant_rzp_webhook_secret"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder="Optional (System will auto-generate if blank)"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="bg-white text-[11px] font-mono h-8 border-blue-200 text-slate-700"
              />
            </div>

            <p className="text-[10px] text-blue-600">
              Active Events to select: <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900">payment.authorized</code>,{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900">payment.captured</code>,{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900">payment.failed</code>,{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900">refund.processed</code>
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Testing Handshake Ping...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Verify & Connect Gateway
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

