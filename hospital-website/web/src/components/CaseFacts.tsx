import { impactFacts } from '../lib/format';
import type { EmergencyContact } from '../types';

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function MechanismLine({ mechanism }: { mechanism: string | null }) {
  if (!mechanism) return null;
  return (
    <p className="mt-1.5 text-sm text-ink-soft">
      <span className="font-medium text-muted">How it happened: </span>
      {mechanism}
    </p>
  );
}

export function ContactSummary({ contacts }: { contacts: EmergencyContact[] }) {
  if (contacts.length === 0) return null;
  const first = contacts[0];
  const rest = contacts.length - 1;
  return (
    <p className="mt-1.5 text-sm text-ink-soft">
      <span className="font-medium text-muted">Emergency contact: </span>
      {first.name ?? first.phone}
      {first.relation ? ` (${first.relation})` : ''}
      {first.phone ? ` · ${first.phone}` : ''}
      {rest > 0 && <span className="text-muted"> · +{rest} more</span>}
    </p>
  );
}

export function ContactList({ contacts }: { contacts: EmergencyContact[] }) {
  if (contacts.length === 0) return null;
  return (
    <div>
      <h4 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Emergency contacts</h4>
      <ul className="mt-2 space-y-2">
        {contacts.map((contact, index) => (
          <li key={`${contact.name ?? 'contact'}-${index}`} className="surface-2 rounded-xl px-3.5 py-2.5">
            <p className="text-sm font-medium">
              {contact.name ?? 'Unnamed contact'}
              {contact.relation && <span className="font-normal text-muted"> · {contact.relation}</span>}
              {contact.primary && (
                <span className="ml-2 chip rounded-full px-2 py-0.5 text-2xs font-semibold">Primary</span>
              )}
            </p>
            {contact.phone && (
              <a
                href={phoneHref(contact.phone)}
                className="tnum mt-0.5 inline-block text-sm text-primary-ink underline-offset-2 hover:underline"
              >
                {contact.phone}
              </a>
            )}
            {contact.email && <p className="truncate text-xs text-muted">{contact.email}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImpactFacts({ impact }: { impact: Record<string, unknown> }) {
  const facts = impactFacts(impact);
  if (facts.length === 0) return null;
  return (
    <div>
      <h4 className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">What the sensors recorded</h4>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {facts.map((fact) => (
          <div key={fact.label} className="surface-2 rounded-xl px-3.5 py-2">
            <dt className="text-2xs tracking-wide text-muted uppercase">{fact.label}</dt>
            <dd className="tnum mt-0.5 text-sm font-semibold">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
