import { useState, useRef, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Palette, PenTool, Sparkles, Loader2, Save, Image as ImageIcon, Move, Type, Trash2, RotateCcw } from "lucide-react";

import { insertDesignSchema } from "@shared/schema";
import type { DesignResponse } from "@shared/routes";
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
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  const [slogan, setSlogan] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [templateColor, setTemplateColor] = useState("#ffffff");
  const [template, setTemplate] = useState<'tshirt' | 'women_tshirt' | 'unisex-hoodie'>('tshirt');

  const templates: Array<{ id: string; label: string }> = [
    { id: 'tshirt', label: 'T-shirt' },
    { id: 'women_tshirt', label: "Women's T-shirt" },
    { id: 'unisex-hoodie', label: 'Hoodie' },
  ];

  const cycleTemplate = (dir: 1 | -1 = 1) => {
    const idx = templates.findIndex(t => t.id === template);
    const next = (idx + dir + templates.length) % templates.length;
    setTemplate(templates[next].id as any);
    form.setValue('template', templates[next].id);
  };
  const [textSize, setTextSize] = useState(24);
  const [textRotation, setTextRotation] = useState(0);
  const [textPosition, setTextPosition] = useState({ x: 200, y: 180 });
  const [image, setImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(50);
  const [imageRotation, setImageRotation] = useState(0);
  const [imagePosition, setImagePosition] = useState({ x: 200, y: 200 });

  const { mutate: createDesign, isPending } = useCreateDesign();
  const { data: designs, isLoading: isLoadingDesigns } = useDesigns();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: zodResolver(insertDesignSchema),
    defaultValues: {
      slogan: "",
      color: "#7c3aed",
      templateColor: "#ffffff",
      template: 'tshirt' as const,
      textSize: 24,
      textRotation: 0,
      textPosition: { x: 200, y: 180 },
      image: null as string | null,
      imageScale: 50,
      imageRotation: 0,
      imagePosition: { x: 200, y: 200 },
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createDesign({
      ...data,
      slogan: slogan || null,
      image: image,
      textSize,
      textRotation,
      textPosition,
      imageScale,
      imageRotation,
      imagePosition,
      templateColor,
      template,
    });
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImage(base64String);
        form.setValue("image", base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
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
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
           
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6 font-display">
              Design your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Masterpiece</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Precisely scale, position, and rotate elements — craft the T-shirt design you envision.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <motion.div className="lg:col-span-5 space-y-8" initial="hidden" animate="visible" variants={containerVariants}>
            <Card className="glass-card overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary animate-gradient" />
              <CardContent className="p-8">
                <Form {...form}>
                  <form onSubmit={onSubmit} className="space-y-6">
                    
                    <motion.div variants={itemVariants} className="space-y-4">
                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-primary" />
                        Slogan
                      </FormLabel>
                      <Input
                        placeholder="e.g. Code Sleep Repeat"
                        className="h-12 text-lg bg-white/50 border-2"
                        value={slogan}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          setSlogan(e.target.value);
                          form.setValue("slogan", e.target.value);
                        }}
                      />
                      {slogan && (
                        <div className="space-y-3 pl-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Type className="w-3 h-3" /> Text Size
                            </span>
                            <span className="text-xs font-bold text-primary">{textSize}px</span>
                          </div>
                          <Slider
                            value={[textSize]}
                            min={12}
                            max={64}
                            step={1}
                            onValueChange={([val]: number[]) => {
                              setTextSize(val);
                              form.setValue("textSize", val);
                            }}
                          />
                          
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <RotateCcw className="w-3 h-3" /> Text Rotation
                            </span>
                            <span className="text-xs font-bold text-primary">{textRotation}°</span>
                          </div>
                          <Slider
                            value={[textRotation]}
                            min={0}
                            max={360}
                            step={1}
                            onValueChange={([val]: number[]) => {
                              setTextRotation(val);
                              form.setValue("textRotation", val);
                            }}
                          />

                          <div className="flex items-center gap-3 mt-4">
                            <Palette className="w-4 h-4 text-primary" />
                            <Input
                              type="color"
                              className="h-10 w-20 cursor-pointer p-1 border-2"
                              value={color}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                setColor(e.target.value);
                                form.setValue("color", e.target.value);
                              }}
                            />
                            <span className="text-sm text-muted-foreground italic">Drag text on canvas</span>
                          </div>

                          <div className="flex items-center gap-3 mt-4">
                            <Palette className="w-4 h-4 text-primary" />
                            <Input
                              type="color"
                              className="h-10 w-20 cursor-pointer p-1 border-2"
                              value={templateColor}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                setTemplateColor(e.target.value);
                                form.setValue("templateColor", e.target.value);
                              }}
                            />
                            <span className="text-sm text-muted-foreground italic">T-shirt template color</span>
                          </div>

                          <div className="flex items-center gap-3 mt-4">
                            <div className="flex items-center gap-3">
                              <img src={`/templates/${template}.png`} alt={template} className="w-16 h-16 rounded border" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-muted-foreground">{templates.find(t => t.id === template)?.label}</span>
                                <div className="flex items-center gap-2 mt-2">
                                  <Button type="button" size="sm" variant="ghost" onClick={() => cycleTemplate(-1)}>▲</Button>
                                  <Button type="button" size="sm" onClick={() => cycleTemplate(1)}>▼</Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    <Separator />

                    <motion.div variants={itemVariants} className="space-y-4">
                      <FormLabel className="text-base font-semibold flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        Graphics
                      </FormLabel>
                      
                      {!image ? (
                        <div 
                          className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImageIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload image (PNG/JPG)</p>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleImageUpload}
                          />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-white/50 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded border overflow-hidden bg-white">
                                <img src={image} className="w-full h-full object-contain" />
                              </div>
                              <span className="text-sm font-medium">Custom Graphic</span>
                            </div>
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive"
                              onClick={() => {
                                setImage(null);
                                form.setValue("image", null);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-3 pl-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Move className="w-3 h-3" /> Scale
                              </span>
                              <span className="text-xs font-bold text-primary">{imageScale}%</span>
                            </div>
                            <Slider
                              value={[imageScale]}
                              min={1}
                              max={200}
                              step={1}
                              onValueChange={([val]: number[]) => {
                                setImageScale(val);
                                form.setValue("imageScale", val);
                              }}
                            />

                            <div className="flex items-center justify-between pt-2">
                              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <RotateCcw className="w-3 h-3" /> Image Rotation
                              </span>
                              <span className="text-xs font-bold text-primary">{imageRotation}°</span>
                            </div>
                            <Slider
                              value={[imageRotation]}
                              min={0}
                              max={360}
                              step={1}
                              onValueChange={([val]: number[]) => {
                                setImageRotation(val);
                                form.setValue("imageRotation", val);
                              }}
                            />
                            <span className="text-xs text-muted-foreground italic block pt-1">Drag image on canvas</span>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    <motion.div variants={itemVariants} className="pt-4">
                      <Button 
                        type="submit" 
                        disabled={isPending}
                        className="w-full h-14 text-lg font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:to-primary shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-5 w-5" />
                            Save Design
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>

          <div className="lg:col-span-7 space-y-8">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <div className="bg-white rounded-3xl p-8 shadow-2xl border border-border/50 relative overflow-hidden group">
                <div className="relative z-10 flex flex-col items-center">
                  <h3 className="text-2xl font-bold font-display text-foreground mb-8 text-center">Interactive Canvas</h3>
                  <div className="transform transition-transform duration-500 hover:scale-[1.01]">
                    <DesignCanvas
                      slogan={slogan}
                      color={color}
                      template={template}
                      templateColor={templateColor}
                      textSize={textSize}
                      textRotation={textRotation}
                      textPosition={textPosition}
                      onTextMove={setTextPosition}
                      image={image}
                      imageScale={imageScale}
                      imageRotation={imageRotation}
                      imagePosition={imagePosition}
                      onImageMove={setImagePosition}
                      width={400}
                      height={400}
                    />
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground font-medium uppercase tracking-widest">
                    Drag elements directly on the T-shirt
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-xl font-bold font-display text-foreground">Design Gallery</h3>
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
                    {designs?.slice().reverse().map((design: DesignResponse) => (
                      <motion.div key={design.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="group relative">
                        <DesignCanvas
                          slogan={design.slogan || ""}
                          color={design.color}
                          template={(design as any).template || 'tshirt'}
                          templateColor={(design as any).templateColor || '#ffffff'}
                          textSize={design.textSize}
                          textRotation={design.textRotation}
                          textPosition={design.textPosition as {x:number, y:number}}
                          image={design.image}
                          imageScale={design.imageScale}
                          imageRotation={design.imageRotation}
                          imagePosition={design.imagePosition as {x:number, y:number}}
                          width={200}
                          height={200}
                          readonly
                        />
                        <div className="mt-3 px-1">
                          <p className="font-semibold text-sm truncate">{design.slogan || "Custom Design"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(design.createdAt!).toLocaleDateString()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
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
