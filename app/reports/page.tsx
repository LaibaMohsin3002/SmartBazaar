
'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase';
import { generateDailyReport } from '@/ai/flows/generate-daily-report';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, where, getDocs, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Newspaper, Trash2, Wheat, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyReport, UserDocument, ReportData } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
import { useLanguage } from '@/context/language-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ReportSkeleton = () => (
    <Card>
        <CardHeader>
            <Skeleton className="h-6 w-1/2 mb-2" />
            <Skeleton className="h-4 w-1/4" />
        </CardHeader>
        <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
        </CardContent>
    </Card>
);

const ReportCard = ({ report }: { report: DailyReport }) => (
    <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline text-2xl">🧾 AgroGuru Daily Farming Report</CardTitle>
            <div className="text-muted-foreground">
                <p>📅 {report.content.dateTime}</p>
                <div className="flex items-center gap-2 mt-1">
                   <MapPin className="h-4 w-4" />
                   <p>{report.content.location}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <Wheat className="h-4 w-4" />
                    <p className="font-medium">{report.crops}</p>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <Separator />
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-semibold mb-2">🌤️ Weather Summary</h3>
                    <p className="text-muted-foreground bg-muted p-3 rounded-lg">{report.content.weatherSummary}</p>
                </div>
                <div>
                    <h3 className="font-semibold mb-2">💧 Irrigation Suggestion</h3>
                    <p className="text-muted-foreground">{report.content.irrigationSuggestion}</p>
                </div>
            </div>
            <div>
                <h3 className="font-semibold mb-2">🧪 Fertilizer Advice</h3>
                <p className="text-muted-foreground">{report.content.fertilizerAdvice}</p>
            </div>
            <div>
                <h3 className="font-semibold mb-2">🐛 Pest & Disease Alerts</h3>
                <p className="text-muted-foreground">{report.content.pestAndDiseaseAlerts}</p>
            </div>
            <Separator />
            <div className="grid md:grid-cols-2 gap-6">
                 <div>
                    <h3 className="font-semibold mb-2">🌾 Crop Health Index</h3>
                    <p className="text-xl font-bold text-primary">{report.content.cropHealthIndex}</p>
                </div>
                 <div>
                    <h3 className="font-semibold mb-2">⚠️ Weather Alerts</h3>
                    <p className="text-yellow-600 font-medium">{report.content.weatherAlerts}</p>
                </div>
            </div>
            <div className="bg-primary/10 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">💡 AI Tip of the Day</h3>
                <p className="text-primary/90">{report.content.aiRecommendation}</p>
            </div>
        </CardContent>
    </Card>
);

const translationKeys = [
    'Your Daily Farming Reports',
    'AI-generated insights based on your farm and local weather.',
    'Generate New Report',
    'Generating...',
    'No reports found.',
    'Generate your first report to get daily advice.',
    'Report for',
    'Generate a New Report',
    'Enter the details for the report you want to generate.',
    'Crops (e.g., Wheat, Cotton)',
    'Cancel',
    'Clear Reports',
    'Are you sure you want to delete all reports?',
    'This action cannot be undone and will permanently delete all your generated reports.',
    'Location (City)',
    'Language'
];

export default function ReportsPage() {
    const { user, data: userData } = useUser();
    const { db } = useFirebase();
    const { toast } = useToast();
    const t = useLanguage().manageTranslations(translationKeys);

    const [reports, setReports] = useState<DailyReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    // Dialog states
    const [cropsForReport, setCropsForReport] = useState('');
    const [locationForReport, setLocationForReport] = useState('');
    const [languageForReport, setLanguageForReport] = useState('en');

    useEffect(() => {
        if (userData?.location?.city) {
            setLocationForReport(userData.location.city);
        }
        if (userData?.language) {
            setLanguageForReport(userData.language);
        }
    }, [userData]);
    

    useEffect(() => {
        if (!user || !db) {
            setIsLoading(false);
            return;
        };

        setIsLoading(true);
        const reportsRef = collection(db, 'users', user.uid, 'dailyReports');
        
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const q = query(reportsRef, where('createdAt', '>=', oneDayAgo), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyReport));
            setReports(fetchedReports);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching reports:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `users/${user.uid}/dailyReports`,
                operation: 'list',
            }));
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, db]);

    const handleGenerateReport = async () => {
        if (!user || !db || !userData || !cropsForReport) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter at least one crop.' });
            return;
        }

        setIsGenerating(true);
        try {
            const result = await generateDailyReport({ 
                user: userData as UserDocument,
                crops: cropsForReport,
                location: locationForReport,
                language: languageForReport,
            });
            
            const newReport = {
                farmerId: user.uid,
                reportDate: format(new Date(), 'yyyy-MM-dd'),
                content: result.reportData,
                crops: cropsForReport,
                createdAt: serverTimestamp() as Timestamp,
            };

            await addDoc(collection(db, 'users', user.uid, 'dailyReports'), newReport);

            toast({
                title: 'Report Generated!',
                description: 'Your new farming report is ready.',
            });
            
            // Reset only crop field for next generation
            setCropsForReport(''); 
            setIsDialogOpen(false);

        } catch (error: any) {
            console.error("Error generating report:", error);
            toast({
                variant: 'destructive',
                title: 'Generation Failed',
                description: error.message || 'Could not generate the daily report.',
            });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleDeleteAllReports = async () => {
        if (!user || !db) return;
        
        setIsDeleting(true);
        try {
            const reportsRef = collection(db, 'users', user.uid, 'dailyReports');
            const querySnapshot = await getDocs(reportsRef);
            
            if (querySnapshot.empty) {
                toast({ description: 'No reports to delete.' });
                setIsDeleting(false);
                return;
            }

            const batch = writeBatch(db);
            querySnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            toast({
                title: 'Reports Cleared',
                description: 'All your previous reports have been deleted.',
            });
        } catch (error) {
            console.error("Error deleting reports:", error);
            toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: 'Could not delete your reports.',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-headline">{t('Your Daily Farming Reports')}</h1>
                    <p className="text-muted-foreground mt-2">{t('AI-generated insights based on your farm and local weather.')}</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={isDeleting || reports.length === 0} className="w-full sm:w-auto">
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                {t('Clear Reports')}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('Are you sure you want to delete all reports?')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('This action cannot be undone and will permanently delete all your generated reports.')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAllReports} className="bg-destructive hover:bg-destructive/90">
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Delete All
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto">
                                <Newspaper className="mr-2 h-4 w-4" />
                                {t('Generate New Report')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{t('Generate a New Report')}</DialogTitle>
                                <DialogDescription>
                                    {t('Enter the details for the report you want to generate.')}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="crops" className="text-right">
                                        Crops
                                    </Label>
                                    <Input
                                        id="crops"
                                        value={cropsForReport}
                                        onChange={(e) => setCropsForReport(e.target.value)}
                                        placeholder={t('Crops (e.g., Wheat, Cotton)')}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="location" className="text-right">
                                        {t('Location (City)')}
                                    </Label>
                                    <Input
                                        id="location"
                                        value={locationForReport}
                                        onChange={(e) => setLocationForReport(e.target.value)}
                                        placeholder="e.g. Faisalabad"
                                        className="col-span-3"
                                    />
                                </div>
                                 <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="language" className="text-right">
                                        {t('Language')}
                                    </Label>
                                    <Select value={languageForReport} onValueChange={(value) => setLanguageForReport(value)}>
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue placeholder="Select language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en">English</SelectItem>
                                            <SelectItem value="ur">Urdu</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">{t('Cancel')}</Button>
                                </DialogClose>
                                <Button onClick={handleGenerateReport} disabled={isGenerating}>
                                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isGenerating ? t('Generating...') : t('Generate New Report')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-6">
                    <ReportSkeleton />
                </div>
            ) : reports.length > 0 ? (
                <div className="space-y-6">
                    {reports.map((report) => (
                        <ReportCard key={report.id} report={report} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 border-2 border-dashed rounded-lg">
                    <Newspaper className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h3 className="text-xl font-medium mt-4">{t('No reports found.')}</h3>
                    <p className="text-md text-muted-foreground mt-2">{t('Generate your first report to get daily advice.')}</p>
                </div>
            )}
        </div>
    );
}
