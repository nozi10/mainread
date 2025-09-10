
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getVoiceProviderSettings, saveVoiceProviderSettings, type VoiceProviderSettings } from '@/lib/admin-actions';
import { getAllVoiceProviders } from '@/ai/flows/voice-selection';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

export default function AdminSettings() {
  const [settings, setSettings] = useState<VoiceProviderSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSettings() {
      setIsLoading(true);
      try {
        const availableProviders = getAllVoiceProviders();
        setProviders(availableProviders);

        const savedSettings = await getVoiceProviderSettings();
        // Initialize settings for any provider not in the database
        const initialSettings: VoiceProviderSettings = {};
        availableProviders.forEach(provider => {
            initialSettings[provider] = savedSettings[provider] ?? true; // Default to true if not set
        });
        setSettings(initialSettings);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to fetch settings.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, [toast]);

  const handleToggle = (provider: string, checked: boolean) => {
    setSettings(prev => ({ ...prev, [provider]: checked }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const result = await saveVoiceProviderSettings(settings);
      if (result.success) {
        toast({ title: 'Success', description: 'Settings have been saved.' });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Voice Provider Management</CardTitle>
          <CardDescription>
            Enable or disable text-to-speech providers for all users. Changes take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.map(provider => (
            <div key={provider} className="flex items-center justify-between p-4 border rounded-lg">
              <Label htmlFor={`provider-${provider}`} className="text-lg capitalize">
                {provider}
              </Label>
              <Switch
                id={`provider-${provider}`}
                checked={settings[provider]}
                onCheckedChange={(checked) => handleToggle(provider, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveChanges} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

    