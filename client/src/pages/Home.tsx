import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Palette, PenTool, ShoppingBag, Sparkles, Loader2, Save, CheckCircle2 } from "lucide-react";

import { insertDesignSchema } from "@shared/schema";
import { useCreateDesign, useDesigns } from "@/hooks/use-designs";
import { DesignCanvas } from "@/components/DesignCanvas";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const PRODUCTS = ["T-Shirt", "Mug", "Hoodie", "Tote Bag", "Cap"];

export default function Home() {
  const [slogan, setSlogan] = useState("");
  const [product, setProduct] = useState("T-Shirt");
  const [color, setColor] = useState("#7c3aed"); // Primary purple

  const { mutate: createDesign, isPending } = useCreateDesign();
  const { data: designs, isLoading: isLoadingDesigns } = useDesigns();

  const form = useForm({
    resolver: zodResolver(insertDesignSchema),
    defaultValues: {
      slogan: "",
      product: "T-Shirt",
      color: "#7c3aed",
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createDesign(data);
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-primary/20">
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-border shadow-sm mb-6">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-foreground/80">Design Studio v1.0</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6 font-display">
              Create your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Merch</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Design custom products in seconds. Visualize your slogan on t-shirts, mugs, and more with our real-time preview engine.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* LEFT COLUMN: Controls */}
          <motion.div 
            className="lg:col-span-5 space-y-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <Card className="glass-card overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary animate-gradient" />
              <CardContent className="p-8">
                <Form {...form}>
                  <form onSubmit={onSubmit} className="space-y-6">
                    
                    {/* Slogan Input */}
                    <motion.div variants={itemVariants}>
                      <FormField
                        control={form.control}
                        name="slogan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold flex items-center gap-2">
                              <PenTool className="w-4 h-4 text-primary" />
                              Your Slogan
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Code Sleep Repeat"
                                className="h-12 text-lg bg-white/50 border-2 focus:ring-primary/20 transition-all"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  setSlogan(e.target.value);
                                }}
                              />
                            </FormControl>
                            <FormDescription>Make it catchy! Short slogans work best.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Product Select */}
                      <motion.div variants={itemVariants}>
                        <FormField
                          control={form.control}
                          name="product"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-primary" />
                                Product
                              </FormLabel>
                              <Select
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  setProduct(val);
                                }}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-12 bg-white/50 border-2">
                                    <SelectValue placeholder="Select product" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {PRODUCTS.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {p}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>

                      {/* Color Picker */}
                      <motion.div variants={itemVariants}>
                        <FormField
                          control={form.control}
                          name="color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold flex items-center gap-2">
                                <Palette className="w-4 h-4 text-primary" />
                                Text Color
                              </FormLabel>
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-12 h-12 rounded-lg shadow-sm border-2 border-white ring-1 ring-border"
                                  style={{ backgroundColor: field.value }}
                                />
                                <FormControl>
                                  <Input
                                    type="color"
                                    className="h-12 w-full cursor-pointer bg-white/50 p-1 border-2"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setColor(e.target.value);
                                    }}
                                  />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                    </div>

                    <motion.div variants={itemVariants} className="pt-4">
                      <Button 
                        type="submit" 
                        disabled={isPending}
                        className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:to-primary shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Saving Design...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-5 w-5" />
                            Save Masterpiece
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>

          {/* RIGHT COLUMN: Preview & History */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Live Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="bg-white rounded-3xl p-8 shadow-2xl border border-border/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <div className="text-9xl font-display font-bold text-foreground select-none pointer-events-none">
                    PREVIEW
                  </div>
                </div>
                
                <div className="relative z-10 flex flex-col items-center">
                  <h3 className="text-2xl font-bold font-display text-foreground mb-8">Live Preview</h3>
                  <div className="transform transition-transform duration-500 hover:scale-[1.02]">
                    <DesignCanvas
                      slogan={slogan}
                      product={product}
                      color={color}
                      width={400}
                      height={400}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Recent Designs List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-xl font-bold font-display text-foreground">Community Designs</h3>
                <span className="text-sm font-medium text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                  {designs?.length || 0} designs
                </span>
              </div>
              
              <ScrollArea className="h-[400px] rounded-2xl border bg-white/50 backdrop-blur-sm p-4">
                {isLoadingDesigns ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {designs?.map((design) => (
                      <motion.div
                        key={design.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="group relative"
                      >
                        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white/90 backdrop-blur rounded-full p-1.5 shadow-sm text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>
                        <DesignCanvas
                          slogan={design.slogan}
                          product={design.product}
                          color={design.color}
                          width={200}
                          height={200}
                        />
                        <div className="mt-3 px-1">
                          <p className="font-semibold text-sm truncate">{design.slogan}</p>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-muted-foreground">{design.product}</p>
                            <div 
                              className="w-3 h-3 rounded-full border border-border" 
                              style={{ backgroundColor: design.color }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {!designs?.length && (
                      <div className="col-span-full py-12 text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                          <PenTool className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No designs yet. Be the first!</p>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
