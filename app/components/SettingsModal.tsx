import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getUserSettings, updateUserSettings } from '@/lib/firebase/settings';
import { useAuth } from '../components/AuthProvider'

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'people' | 'events'>('people');
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);
  const [newRelationship, setNewRelationship] = useState('');

  const [eventCategories, setEventCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (user?.uid) {
      getUserSettings(user.uid).then((settings) => {
        setRelationshipTypes(settings.relationshipTypes || []);
        setEventCategories(settings.eventCategories || []);
      });
    }
  }, [user]);

  const saveSettings = async () => {
    if (!user?.uid) return;
    await updateUserSettings(user.uid, {
      relationshipTypes,
      eventCategories,
    });
  };

  const handleAdd = (type: 'relationship' | 'category') => {
    if (type === 'relationship' && newRelationship.trim()) {
      setRelationshipTypes((prev) => [...prev, newRelationship.trim()]);
      setNewRelationship('');
    }
    if (type === 'category' && newCategory.trim()) {
      setEventCategories((prev) => [...prev, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemove = (type: 'relationship' | 'category', value: string) => {
    if (type === 'relationship') {
      setRelationshipTypes((prev) => prev.filter((item) => item !== value));
    } else {
      setEventCategories((prev) => prev.filter((item) => item !== value));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-40 bg-muted p-4 space-y-2 border-r">
            <Button
              variant={activeSection === 'people' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('people')}
              className="w-full"
            >
              Pessoas
            </Button>
            <Button
              variant={activeSection === 'events' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('events')}
              className="w-full"
            >
              Eventos
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {activeSection === 'people' ? 'Tipos de Relacionamento' : 'Categorias de Evento'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {(activeSection === 'people' ? relationshipTypes : eventCategories).map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="flex-1 text-muted-foreground">{item}</span>
                  <Button variant="destructive" size="sm" onClick={() => handleRemove(activeSection === 'people' ? 'relationship' : 'category', item)}>
                    Remover
                  </Button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Input
                  placeholder={`Novo ${activeSection === 'people' ? 'relacionamento' : 'categoria'}`}
                  value={activeSection === 'people' ? newRelationship : newCategory}
                  onChange={(e) =>
                    activeSection === 'people'
                      ? setNewRelationship(e.target.value)
                      : setNewCategory(e.target.value)
                  }
                />
                <Button onClick={() => handleAdd(activeSection === 'people' ? 'relationship' : 'category')}>
                  Adicionar
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={saveSettings}>Salvar alterações</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};