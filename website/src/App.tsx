import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, MessageSquareShare, ShieldCheck, Users2, Smartphone, Clock, Zap } from 'lucide-react';
import { useMemo } from 'react';
import Hyperspeed from './components/Hyperspeed';

function App() {
  const hyperspeedOptions = useMemo(() => ({
    distortion: 'turbulentDistortion',
    length: 400,
    roadWidth: 10,
    islandWidth: 2,
    lanesPerRoad: 3,
    fov: 90,
    fovSpeedUp: 150,
    speedUp: 2,
    carLightsFade: 0.4,
    totalSideLightSticks: 20,
    lightPairsPerRoadWay: 40,
    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12, 0.5],
    lightStickHeight: [1.3, 1.7],
    movingAwaySpeed: [60, 80],
    movingCloserSpeed: [-120, -160],
    carLightsLength: [12, 80],
    carLightsRadius: [0.05, 0.14],
    carWidthPercentage: [0.3, 0.5],
    carShiftX: [-0.8, 0.8],
    carFloorSeparation: [0, 5],
    colors: {
      roadColor: 0x080808,
      islandColor: 0x0a0a0a,
      background: 0x000000,
      shoulderLines: 0x131313,
      brokenLines: 0x131313,
      leftCars: [0x7BEB78, 0x5AD857, 0x3CA23B],
      rightCars: [0x7BEB78, 0x5AD857, 0x3CA23B],
      sticks: 0x7BEB78,
    }
  }), []);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20">
      {/* Navigation */}
      <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
        <nav className="flex items-center justify-between px-6 py-3 rounded-full backdrop-blur-xl bg-[#0a0a0a]/80 border border-white/10 text-white shadow-2xl w-full max-w-4xl">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Cavo SMS Logo" className="h-6 w-6 object-contain" />
            <span className="font-display font-bold text-lg tracking-tight">Cavo SMS</span>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Features</a>
              <a href="#workflow" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Workflow</a>
            </div>
            <a 
              href="mailto:2humpyt@gmail.com" 
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95"
            >
              Get License
            </a>
          </div>
        </nav>
      </div>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32 bg-black text-white min-h-[90vh] flex flex-col justify-center">
          <div className="absolute inset-0 z-0">
            <Hyperspeed effectOptions={hyperspeedOptions} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-background/50 to-background z-0 pointer-events-none" />
          
          <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl mx-auto flex flex-col items-center"
            >
              <h1 className="text-5xl md:text-6xl lg:text-8xl font-display font-bold tracking-tight mb-8 leading-[1.05]">
                Send smarter, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">
                  not harder.
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-white/70 mb-10 leading-relaxed max-w-2xl">
                Built for field teams, campaigns, and operations crews that need clean contact handling and reliable native SMS delivery directly from your device.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <a 
                  href="mailto:2humpyt@gmail.com"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-[0_0_40px_rgba(123,235,120,0.3)] hover:shadow-[0_0_60px_rgba(123,235,120,0.4)]"
                >
                  Request Early Access
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a 
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/10"
                >
                  See how it works
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Magical Intersection Line */}
        <div className="relative h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent">
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[300px] h-[2px] bg-primary blur-[8px]"></div>
        </div>

        {/* Features Grid */}
        <section id="features" className="py-32 bg-background relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="container mx-auto px-6 relative z-10">
            <div className="mb-20 max-w-3xl text-center md:text-left">
              <h2 className="text-sm font-bold uppercase tracking-widest text-primary mb-3">Enterprise Capabilities</h2>
              <h3 className="text-4xl md:text-5xl font-display font-bold">Your phone is now a powerful delivery engine.</h3>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Users2,
                  title: 'Contact Intake',
                  description: 'Import CSV or phone-only files, spot duplicates before they land, and keep tags ready.'
                },
                {
                  icon: Smartphone,
                  title: 'Native Delivery',
                  description: 'Queue and retry safely using your device\'s native Android SMS capabilities.'
                },
                {
                  icon: Clock,
                  title: 'Smart Scheduling',
                  description: 'Plan your campaigns ahead of time. Set dates, times, and let your device handle dispatching automatically.'
                },
                {
                  icon: BarChart3,
                  title: 'Operational View',
                  description: 'Track what shipped, failed, and needs attention with detailed batch analytics.'
                },
                {
                  icon: Zap,
                  title: 'Bark SMS Ready',
                  description: 'Leveraging reliable background queuing (often known in the field as "bark sms"), your messages are pushed persistently and aggressively.'
                },
                {
                  icon: ShieldCheck,
                  title: 'Privacy First',
                  description: 'No third-party APIs. Your data, contacts, and message history stay securely on your device.'
                }
              ].map((feature, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="group rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-8 border border-white/15 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:from-white/[0.12] hover:to-white/[0.05] hover:border-primary/50 hover:shadow-[0_0_60px_rgba(123,235,120,0.2)] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" />
                  <div className="absolute top-0 right-0 w-40 h-40 bg-primary/15 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-125 group-hover:bg-primary/25 blur-3xl z-0" />
                  
                  <div className="relative z-10">
                    <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/40 to-primary/20 border border-primary/50 flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 group-hover:border-primary/70 group-hover:from-primary/50 group-hover:to-primary/30 shadow-lg shadow-primary/20">
                      <feature.icon className="h-8 w-8 text-primary group-hover:text-white transition-colors" />
                    </div>
                    <h4 className="text-xl font-bold mb-3 text-white">{feature.title}</h4>
                    <p className="text-white/70 text-sm leading-relaxed group-hover:text-white/90 transition-colors">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="py-24 lg:py-32 overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/10 blur-[80px] rounded-full" />
                  <img 
                    src="/feature_abstract.png" 
                    alt="Fast Secure Messaging" 
                    className="relative z-10 rounded-[2rem] w-full max-w-lg mx-auto shadow-2xl border border-border/50"
                  />
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-sm font-bold uppercase tracking-wider text-primary mb-3">Live Workflow</h2>
                <h3 className="text-4xl lg:text-5xl font-display font-bold mb-10">Audience to delivery in seconds.</h3>
                
                <div className="space-y-8">
                  {[
                    {
                      step: '01',
                      title: 'Import Lists',
                      desc: 'Pull your audience straight from CSV files or paste numbers directly.'
                    },
                    {
                      step: '02',
                      title: 'Build Message',
                      desc: 'Write one message and personalize it with tags like {name}.'
                    },
                    {
                      step: '03',
                      title: 'Review Outcomes',
                      desc: 'Watch the live queue and export evidence when a campaign needs a paper trail.'
                    }
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-6 relative">
                      {idx !== 2 && (
                        <div className="absolute left-[1.35rem] top-14 bottom-[-2rem] w-px bg-border" />
                      )}
                      <div className="h-11 w-11 shrink-0 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-sm text-muted-foreground z-10">
                        {item.step}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                        <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-foreground" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          
          <div className="container mx-auto px-6 relative z-10 text-center">
            <h2 className="text-4xl md:text-6xl font-display font-bold text-background mb-6">
              Ready to move fast?
            </h2>
            <p className="text-lg text-muted/70 mb-10 max-w-2xl mx-auto">
              Get the native campaign console built for operations crews and marketing teams.
            </p>
            <a 
              href="mailto:2humpyt@gmail.com"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-10 py-5 text-base font-bold text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105"
            >
              Get Cavo SMS Today
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-primary text-black py-16 relative overflow-hidden rounded-t-[3rem] mt-[-2rem] z-20">
        {/* Subtle inner shadow/gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
        
        <div className="container mx-auto px-6 relative z-10 flex flex-col items-center">
          <img src="/logo.png" alt="Cavo SMS Logo" className="h-32 w-32 object-contain mb-8" />
          
          <h2 className="text-4xl md:text-6xl font-display font-black tracking-tighter mb-8 text-[#0a0a0a]">Cavo SMS</h2>
          
          <div className="flex flex-wrap justify-center gap-8 mb-12 font-bold text-sm text-[#0a0a0a]">
            <a href="#features" className="hover:opacity-70 transition-opacity">Features</a>
            <a href="#workflow" className="hover:opacity-70 transition-opacity">Workflow</a>
            <a href="mailto:2humpyt@gmail.com" className="hover:opacity-70 transition-opacity">Contact</a>
            <a href="https://cavemotins.com" target="_blank" rel="noreferrer" className="hover:opacity-70 transition-opacity">Cave Motions</a>
            <a href="#" className="hover:opacity-70 transition-opacity">Privacy Policy</a>
          </div>
          
          <div className="w-full max-w-2xl h-px bg-black/10 mb-8" />
          
          <p className="text-black/60 font-medium text-sm">
            � {new Date().getFullYear()} Cavo SMS. All rights reserved. Built for speed.
          </p>
          <p className="text-black/60 font-medium text-sm mt-2">
            Product of <a href="https://cavemotins.com" target="_blank" rel="noreferrer" className="underline hover:text-black">Cave Motions</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
