import { Mail, Phone, Send } from "lucide-react";

export function ContactLinks({ className = "" }: { className?: string }) {
  return (
    <address className={`contact-links ${className}`} aria-label="Контакты BOBAR">
      <a href="tel:+375292074174">
        <Phone size={18} aria-hidden="true" />
        <span>+375 29 207-41-74</span>
      </a>
      <a href="mailto:webobarby@gmail.com">
        <Mail size={18} aria-hidden="true" />
        <span>webobarby@gmail.com</span>
      </a>
      <a href="https://t.me/bobarby" target="_blank" rel="noopener noreferrer" aria-label="Telegram: @bobarby">
        <Send size={18} aria-hidden="true" />
        <span>@bobarby</span>
      </a>
    </address>
  );
}
