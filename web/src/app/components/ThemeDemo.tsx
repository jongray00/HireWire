import { ThemeToggle, ThemeToggleCompact } from './ThemeToggle';

/**
 * SignalWire Theme Demo Component
 * Showcases all brand colors and theme features
 */
export function ThemeDemo() {
  return (
    <div className="min-h-screen bg-theme-primary text-theme-primary transition-colors">
      {/* Header */}
      <header className="border-b border-theme-border bg-theme-secondary">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-heading font-bold text-theme-primary">
                SignalWire
              </h1>
              <p className="mt-1 text-sm text-theme-secondary">
                Develop. Deploy. Disrupt.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggleCompact />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <section className="mb-16">
          <h2 className="text-2xl font-heading font-bold text-theme-primary mb-6">
            Brand Identity
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Straightforward', value: 'STRAIGHTFORWARD' },
              { label: 'Bold', value: 'BOLD' },
              { label: 'Experienced', value: 'EXPERIENCED' },
              { label: 'Authoritative', value: 'AUTHORITATIVE' },
              { label: 'Committed', value: 'COMMITTED' },
              { label: 'Trustworthy', value: 'TRUSTWORTHY' },
            ].map((trait) => (
              <div
                key={trait.value}
                className="p-4 rounded-lg border-2 border-theme-border bg-theme-secondary hover:border-sw-blue dark:hover:border-sw-pink transition-colors"
              >
                <p className="text-xs font-bold text-theme-secondary uppercase tracking-wide">
                  {trait.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Primary Brand Colors */}
        <section className="mb-16">
          <h2 className="text-2xl font-heading font-bold text-theme-primary mb-6">
            Primary Brand Colors
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorCard
              name="SignalWire Blue"
              hex="#044ef4"
              className="bg-sw-blue"
              description="Logo, links, fills on light backgrounds"
            />
            <ColorCard
              name="SignalWire Pink"
              hex="#f72a72"
              className="bg-sw-pink"
              description="Logo, accents on dark backgrounds"
            />
            <ColorCard
              name="Mist"
              hex="#f1f8ff"
              className="bg-sw-mist"
              description="Light backgrounds"
              textDark
            />
            <ColorCard
              name="Breeze"
              hex="#b7d9ff"
              className="bg-sw-breeze"
              description="Strokes, fills, accents"
              textDark
            />
            <ColorCard
              name="Deep Sea"
              hex="#0336ab"
              className="bg-sw-deepSea"
              description="Emphasis, fills, accent"
            />
          </div>
        </section>

        {/* Neutral Colors */}
        <section className="mb-16">
          <h2 className="text-2xl font-heading font-bold text-theme-primary mb-6">
            Neutral Colors
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <ColorCard
              name="Charcoal"
              hex="#050910"
              className="bg-sw-charcoal"
              description="Primary text"
              compact
            />
            <ColorCard
              name="Grey 2"
              hex="#55606a"
              className="bg-sw-grey-2"
              description="Body text"
              compact
            />
            <ColorCard
              name="Grey 4"
              hex="#8d969e"
              className="bg-sw-grey-4"
              description="Secondary text"
              compact
            />
            <ColorCard
              name="Grey 6"
              hex="#bec3c9"
              className="bg-sw-grey-6"
              description="Strokes, disabled"
              compact
              textDark
            />
            <ColorCard
              name="Grey 8"
              hex="#f5f7fa"
              className="bg-sw-grey-8"
              description="Fills, strokes"
              compact
              textDark
            />
          </div>
        </section>

        {/* Secondary Colors */}
        <section className="mb-16">
          <h2 className="text-2xl font-heading font-bold text-theme-primary mb-6">
            Secondary Colors
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ColorCard
              name="Green"
              hex="#00aa96"
              className="bg-sw-green"
              description="Positive indicators"
              compact
            />
            <ColorCard
              name="Yellow"
              hex="#ffca31"
              className="bg-sw-yellow"
              description="Warning indicators"
              compact
              textDark
            />
            <ColorCard
              name="Purple"
              hex="#6432e6"
              className="bg-sw-purple"
              description="Accent color"
              compact
            />
            <ColorCard
              name="Red"
              hex="#ff002b"
              className="bg-sw-red"
              description="Negative indicators"
              compact
            />
          </div>
        </section>

        {/* Interactive Elements */}
        <section className="mb-16">
          <h2 className="text-2xl font-heading font-bold text-theme-primary mb-6">
            Interactive Elements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Primary Button */}
            <div className="p-6 rounded-lg bg-theme-secondary border border-theme-border">
              <h3 className="text-sm font-bold text-theme-secondary mb-4 uppercase">
                Primary Button
              </h3>
              <button className="w-full px-6 py-3 rounded-lg bg-sw-blue hover:bg-sw-deepSea dark:bg-sw-pink dark:hover:bg-sw-pink/90 text-white font-medium transition-colors">
                Click Me
              </button>
            </div>

            {/* Secondary Button */}
            <div className="p-6 rounded-lg bg-theme-secondary border border-theme-border">
              <h3 className="text-sm font-bold text-theme-secondary mb-4 uppercase">
                Secondary Button
              </h3>
              <button className="w-full px-6 py-3 rounded-lg border-2 border-sw-blue dark:border-sw-pink text-sw-blue dark:text-sw-pink hover:bg-sw-blue hover:text-white dark:hover:bg-sw-pink dark:hover:text-white font-medium transition-colors">
                Click Me
              </button>
            </div>

            {/* Input Field */}
            <div className="p-6 rounded-lg bg-theme-secondary border border-theme-border">
              <h3 className="text-sm font-bold text-theme-secondary mb-4 uppercase">
                Input Field
              </h3>
              <input
                type="text"
                placeholder="Enter text..."
                className="w-full px-4 py-3 rounded-lg border border-theme-border bg-theme-primary text-theme-primary focus:border-sw-blue dark:focus:border-sw-pink focus:ring-2 focus:ring-sw-blue/20 dark:focus:ring-sw-pink/20 transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-2xl font-heading font-bold text-theme-primary mb-6">
            Typography
          </h2>
          <div className="space-y-6 p-8 rounded-lg bg-theme-secondary border border-theme-border">
            <div>
              <p className="text-xs text-theme-secondary mb-2">HEADLINE (Neue Einstellung Bold)</p>
              <h1 className="text-4xl font-heading font-bold text-theme-primary">
                Develop. Deploy. Disrupt.
              </h1>
            </div>
            <div>
              <p className="text-xs text-theme-secondary mb-2">BODY TEXT (Inter Regular)</p>
              <p className="text-base text-theme-primary">
                Our mission is simple. To empower you to build whatever you can imagine utilizing
                software-defined telecom capabilities. Whether it's a product, service, application,
                or enterprise communication tool, we want you to focus on your idea.
              </p>
            </div>
            <div>
              <p className="text-xs text-theme-secondary mb-2">SECONDARY TEXT</p>
              <p className="text-sm text-theme-secondary">
                This is secondary text used for captions, helpers, and supporting information.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

interface ColorCardProps {
  name: string;
  hex: string;
  className: string;
  description: string;
  compact?: boolean;
  textDark?: boolean;
}

function ColorCard({ name, hex, className, description, compact, textDark }: ColorCardProps) {
  return (
    <div
      className={`rounded-lg overflow-hidden border border-theme-border shadow-sm hover:shadow-md transition-shadow ${
        compact ? 'h-32' : 'h-40'
      }`}
    >
      <div className={`${className} h-16 ${compact ? '' : 'h-20'}`}></div>
      <div className="p-3 bg-theme-secondary">
        <p className={`font-bold text-sm ${textDark ? 'text-theme-primary' : 'text-theme-primary'}`}>
          {name}
        </p>
        <p className="text-xs text-theme-tertiary font-mono">{hex}</p>
        {!compact && <p className="text-xs text-theme-secondary mt-1">{description}</p>}
      </div>
    </div>
  );
}
