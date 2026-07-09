import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { useAuthStore } from "@/store/authStore";
import { useIntegrationStore } from "@/store/integrationStore";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings - Jigo AI Workspace" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const connections = useIntegrationStore((s) => s.connections);
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    setSaving(false);
    if (error) {
      toast.error("Failed to update profile", { description: error.message });
    } else {
      toast.success("Profile updated");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader title="Settings" description="Manage your profile, preferences, and workspace." />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6 flex h-auto flex-wrap gap-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={user?.email || ""} disabled />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Input value={user?.role || ""} disabled />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Theme</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`rounded-lg border p-4 text-left transition-colors ${theme === t ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/50"}`}
                  >
                    <div className="text-sm font-medium capitalize text-foreground">{t}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t === "dark" ? "Enterprise dark, easy on the eyes" : "Bright and airy"}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold">Connected apps</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link to="/integrations">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.accountLabel || "Not connected"}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {c.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">API configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Base URL</Label>
                <Input defaultValue="/api" />
              </div>
              <div className="grid gap-2">
                <Label>API key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-…"
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm">Save</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-foreground">Two-factor authentication</div>
                  <div className="text-xs text-muted-foreground">
                    Add an extra layer of security
                  </div>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-foreground">Session notifications</div>
                  <div className="text-xs text-muted-foreground">Email me on new sign-ins</div>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-destructive">Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-foreground">Delete workspace</div>
                  <div className="text-xs text-muted-foreground">This cannot be undone.</div>
                </div>
                <Button variant="destructive" size="sm">
                  Delete workspace
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
