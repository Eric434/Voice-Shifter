import { Switch, Route, Router as WouterRouter, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Studio from "@/pages/Studio";
import About from "@/pages/About";
import { Activity } from "lucide-react";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <header className="h-14 border-b border-border flex items-center px-6 gap-6 bg-card">
        <div className="flex items-center gap-2 text-primary">
          <Activity className="w-5 h-5" />
          <span className="font-mono font-bold tracking-wider">VOICEMASK</span>
        </div>
        <nav className="flex items-center gap-4 text-sm font-mono">
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors data-[active=true]:text-primary">
            STUDIO
          </Link>
          <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors data-[active=true]:text-primary">
            ABOUT
          </Link>
        </nav>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Studio} />
        <Route path="/about" component={About} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
