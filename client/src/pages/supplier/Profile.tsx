import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    User,
    Mail,
    Shield,
    Key,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    Building
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

export default function SupplierProfile() {
    const { user, token } = useAuth();
    const { toast } = useToast();
    const [userData, setUserData] = useState<any>(null);
    const [providerData, setProviderData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
        resolver: zodResolver(passwordSchema)
    });

    useEffect(() => {
        async function fetchProfile() {
            if (!user?.id) return;
            try {
                const res = await fetch(`/api/supplier/profile`, {
                    headers: { Authorization: token ? `Bearer ${token}` : '' }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUserData(data);
                    
                    if (data.associated_provider_id) {
                        const pRes = await fetch(`/api/public/providers`, {
                             headers: { Authorization: token ? `Bearer ${token}` : '' }
                        });
                        if (pRes.ok) {
                            const providers = await pRes.json();
                            const provider = providers.find((p: any) => p.id === data.associated_provider_id);
                            if (provider) setProviderData(provider);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to fetch profile', e);
            }
        }
        fetchProfile();
    }, [user?.id, token]);

    const onSubmit = async (data: PasswordForm) => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                toast({
                    title: "Success",
                    description: "Password updated successfully",
                    variant: "default",
                });
                reset();
            } else {
                const errorData = await res.json();
                toast({
                    title: "Error",
                    description: errorData.message || "Failed to update password",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "An unexpected error occurred",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Designer Profile</h1>
                <p className="text-muted-foreground">Manage your account details and security settings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 border-primary/10 shadow-sm">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto size-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                            <User className="size-10 text-primary" />
                        </div>
                        <CardTitle>{userData?.name || user?.name}</CardTitle>
                        <CardDescription className="capitalize">
                            <Badge variant="secondary" className="mt-1 font-semibold">
                                {userData?.role?.replace('_', ' ') || user?.role?.replace('_', ' ')}
                            </Badge>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4 border-t">
                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="size-4 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Email Address</span>
                                <span className="font-medium">{userData?.email || user?.email}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Shield className="size-4 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Account Status</span>
                                <span className={cn(
                                    "font-medium capitalize",
                                    userData?.status === 'active' ? "text-green-600" : "text-yellow-600"
                                )}>
                                    {userData?.status || 'Active'}
                                </span>
                            </div>
                        </div>
                        {providerData && (
                            <div className="flex items-center gap-3 text-sm">
                                <Building className="size-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">Print Provider</span>
                                    <span className="font-medium">{providerData.name}</span>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-sm">
                            <CheckCircle className="size-4 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Permissions</span>
                                <span className="font-medium">Design Access Only</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-6">
                    <Card className="shadow-sm border-primary/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Key className="size-5 text-primary" />
                                Change Password
                            </CardTitle>
                            <CardDescription>
                                Update your password to keep your account secure.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="currentPassword">Current Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="currentPassword"
                                            type={showCurrentPassword ? "text" : "password"}
                                            placeholder="Enter your current password"
                                            {...register('currentPassword')}
                                            className={errors.currentPassword ? "border-red-500" : ""}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                    {errors.currentPassword && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertCircle className="size-3" />
                                            {errors.currentPassword.message}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">New Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="newPassword"
                                                type={showNewPassword ? "text" : "password"}
                                                placeholder="At least 6 characters"
                                                {...register('newPassword')}
                                                className={errors.newPassword ? "border-red-500" : ""}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                            </button>
                                        </div>
                                        {errors.newPassword && (
                                            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                                <AlertCircle className="size-3" />
                                                {errors.newPassword.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="Repeat new password"
                                            {...register('confirmPassword')}
                                            className={errors.confirmPassword ? "border-red-500" : ""}
                                        />
                                        {errors.confirmPassword && (
                                            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                                <AlertCircle className="size-3" />
                                                {errors.confirmPassword.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full sm:w-auto min-w-[120px]"
                                    >
                                        {loading ? "Updating..." : "Update Password"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
