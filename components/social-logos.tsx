'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Popover } from 'radix-ui';
import { profile } from '@/lib/profile';

const socialMedia = [
  { name: 'GitHub', icon: '/icons/github.svg', account: profile.contacts.github, accountLabel: 'Name' },
  { name: 'Gmail', icon: '/icons/gmail.svg', account: profile.contacts.gmail, accountLabel: 'Email' },
  { name: 'Douyin', icon: '/icons/tiktok.svg', account: profile.contacts.douyin, accountLabel: 'Account ID' },
  { name: 'rednote', icon: '/icons/xiaohongshu.svg', account: profile.contacts.xiaohongshu, accountLabel: 'Account ID' },
];

export default function SocialLogos() {
  const [active, setActive] = useState<string | null>(null);
  const pinned = useRef<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const id = useId();

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  function cancelClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function close() {
    cancelClose();
    pinned.current = null;
    setActive(null);
  }

  function preview(name: string) {
    cancelClose();
    if (pinned.current !== name) pinned.current = null;
    setActive(name);
  }

  function scheduleClose(name: string) {
    cancelClose();
    if (pinned.current === name) return;
    // Allow the pointer to cross the small gap between the icon and popup.
    closeTimer.current = window.setTimeout(() => {
      setActive(current => current === name ? null : current);
      closeTimer.current = null;
    }, 180);
  }

  function toggle(name: string) {
    cancelClose();
    if (pinned.current === name) {
      close();
    } else {
      pinned.current = name;
      setActive(name);
    }
  }

  return (
    <section className="home-contact" aria-labelledby="contact-heading">
      <h2 className="home-contact-title" id="contact-heading">CONTACT ME</h2>
      <div className="home-socials" role="group" aria-label="Social media">
        {socialMedia.map(({ name, icon, account, accountLabel }) => (
          <Popover.Root
            key={name}
            open={active === name}
            onOpenChange={open => {
              if (open) preview(name);
              else if (active === name) close();
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="home-social-logo"
                aria-label={`Show ${name} contact details`}
                aria-describedby={active === name ? `${id}-${name}-account` : undefined}
                onPointerEnter={event => { if (event.pointerType !== 'touch') preview(name); }}
                onPointerLeave={() => scheduleClose(name)}
                onFocus={() => preview(name)}
                onClick={event => {
                  // The first click pins a popup that may already be open on hover.
                  event.preventDefault();
                  toggle(name);
                }}
              >
                <img src={icon} alt="" width={32} height={32} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="home-social-popover"
                side="top"
                sideOffset={12}
                collisionPadding={16}
                aria-labelledby={`${id}-${name}-title`}
                aria-describedby={`${id}-${name}-account`}
                onPointerEnter={cancelClose}
                onPointerLeave={() => scheduleClose(name)}
                onOpenAutoFocus={event => event.preventDefault()}
                onCloseAutoFocus={event => event.preventDefault()}
                onFocusOutside={event => {
                  const target = event.detail.originalEvent.target;
                  // Let keyboard focus move directly between the social icons.
                  if (target instanceof HTMLElement && target.closest('.home-social-logo')) event.preventDefault();
                }}
              >
                <h3 id={`${id}-${name}-title`}>{name}</h3>
                <p className="home-social-account-label">{accountLabel}</p>
                <p id={`${id}-${name}-account`} className={`home-social-account${account ? '' : ' is-empty'}`}>
                  {account || 'Not added yet'}
                </p>
                <Popover.Arrow className="home-social-popover-arrow" width={12} height={6} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ))}
      </div>
    </section>
  );
}
