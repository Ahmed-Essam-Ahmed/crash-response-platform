import { useState } from 'react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './Button';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Icon } from './ui/Icon';
import { Lock, Moon, Settings, Sun, User } from 'lucide-react';
import { useTheme } from '../theme';

export function AccountSettingsModal({
  open,
  onClose,
  userName,
  email,
  role,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  email?: string;
  role: string;
  onSignOut: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Account settings" size="md">
      <div className="flex flex-col gap-4">
        <Card padded className="p-4">
          <CardHeader
            icon={<Icon icon={User} size={18} />}
            title={userName}
            subtitle={email ? email : `${role} account`}
          />
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <span className="text-muted">Role</span>
              <span className="capitalize font-medium">{role}</span>
            </div>
          </div>
        </Card>

        <Card padded className="p-4">
          <CardHeader icon={<Icon icon={Sun} size={18} />} title="Appearance" subtitle="Toggle light and dark mode" />
          <div className="mt-4 flex items-center justify-between rounded-lg border border-line px-3 py-2">
            <div className="flex items-center gap-2">
              <Icon icon={theme.mode === 'dark' ? Moon : Sun} size={16} />
              <span className="text-sm">{theme.mode === 'dark' ? 'Dark mode' : 'Light mode'}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => theme.toggle()}
              disabled={busy}
            >
              Switch
            </Button>
          </div>
        </Card>

        <Card padded className="p-4">
          <CardHeader icon={<Icon icon={Lock} size={18} />} title="Security" subtitle="Manage your session" />
          <div className="mt-4 flex items-center justify-end">
            <Button variant="danger" onClick={onSignOut} disabled={busy}>
              Sign out
            </Button>
          </div>
        </Card>

        <Alert tone="info" title="More coming soon">
          Change password and profile details will be added next.
        </Alert>
      </div>
    </Modal>
  );
}
