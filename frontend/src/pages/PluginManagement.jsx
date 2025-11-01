import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Cloud, ArrowLeft, Puzzle, Shield, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PluginManagement({ user }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState(null);

  useEffect(() => {
    loadPlugins();
  }, []);

  const getAuthHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/plugins`, getAuthHeader());
      setPlugins(response.data);
    } catch (error) {
      toast.error('Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  const togglePlugin = async (pluginName, currentState) => {
    try {
      await axios.put(`${API}/admin/plugins/${pluginName}`, {
        enabled: !currentState
      }, getAuthHeader());
      
      toast.success(t('pluginUpdated'));
      loadPlugins();
    } catch (error) {
      toast.error('Failed to update plugin');
    }
  };

  const updatePluginSettings = async (pluginName, settings) => {
    try {
      await axios.put(`${API}/admin/plugins/${pluginName}`, {
        enabled: editingPlugin.enabled,
        settings: settings
      }, getAuthHeader());
      
      toast.success(t('pluginUpdated'));
      setEditingPlugin(null);
      loadPlugins();
    } catch (error) {
      toast.error('Failed to update plugin settings');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} data-testid="back-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 shadow-md">
                <Puzzle className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">{t('pluginManagement')}</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-500" />
              {t('pluginManagement')}
            </CardTitle>
            <CardDescription>{t('managePlugins')}</CardDescription>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="text-center py-8">{t('loading')}</div>
        ) : (
          <div className="space-y-4">
            {plugins.map((plugin) => (
              <Card key={plugin.name} className="hover-lift" data-testid={`plugin-${plugin.name}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg">
                          {plugin.name === 'file_type_filter' ? t('fileTypeFilter') : plugin.name}
                        </CardTitle>
                        <Badge variant={plugin.enabled ? 'default' : 'secondary'} data-testid={`plugin-status-${plugin.name}`}>
                          {plugin.enabled ? t('enabled') : t('disabled')}
                        </Badge>
                      </div>
                      <CardDescription>
                        {plugin.name === 'file_type_filter' 
                          ? t('fileTypeFilterDesc')
                          : plugin.settings?.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={plugin.enabled}
                      onCheckedChange={() => togglePlugin(plugin.name, plugin.enabled)}
                      data-testid={`plugin-toggle-${plugin.name}`}
                    />
                  </div>
                </CardHeader>
                
                {plugin.name === 'file_type_filter' && (
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          {t('blockedFileTypes')}
                        </label>
                        {editingPlugin?.name === plugin.name ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingPlugin.settings.blocked_extensions.join(', ')}
                              onChange={(e) => setEditingPlugin({
                                ...editingPlugin,
                                settings: {
                                  ...editingPlugin.settings,
                                  blocked_extensions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                }
                              })}
                              placeholder=".php, .exe, .bat"
                              className="font-mono text-sm"
                              rows={3}
                              data-testid="blocked-extensions-input"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updatePluginSettings(plugin.name, editingPlugin.settings)}
                                className="bg-purple-500 hover:bg-purple-600 text-white"
                                data-testid="save-plugin-settings"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                {t('save')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingPlugin(null)}
                                data-testid="cancel-edit-plugin"
                              >
                                {t('cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="p-3 bg-background-secondary rounded-lg border border-border mb-2">
                              <code className="text-sm text-muted-foreground" data-testid="blocked-extensions-display">
                                {plugin.settings?.blocked_extensions?.join(', ') || 'None'}
                              </code>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingPlugin(plugin)}
                              data-testid="edit-plugin-settings"
                            >
                              {t('edit')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
