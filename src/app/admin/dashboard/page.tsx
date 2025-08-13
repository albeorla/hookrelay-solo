"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import {
  CalendarCheck,
  Receipt,
  UploadCloud,
  CreditCard,
  CheckCheck,
  Calendar,
  Users,
  AlarmClock,
  Wrench,
  PieChart,
  Brush,
} from "lucide-react";
import { AuthenticatedLayout } from "~/components/layout/authenticated-layout";

function DashboardPage() {
  const getTodayDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto h-full w-full py-12">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">{getTodayDate()}</p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>To-do</CardTitle>
                  <Button variant="link">View all</Button>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  <ul className="space-y-4">
                    <li className="flex items-center gap-4">
                      <CalendarCheck className="text-primary h-6 w-6" />
                      <div className="flex-grow">
                        <p className="font-semibold">Review requests</p>
                        <p className="text-muted-foreground text-sm">
                          Approve new requests in your inbox
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        Today
                      </span>
                    </li>
                    <li className="flex items-center gap-4">
                      <Receipt className="text-primary h-6 w-6" />
                      <div className="flex-grow">
                        <p className="font-semibold">Process invoices</p>
                        <p className="text-muted-foreground text-sm">
                          You have 1 to review
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        Today
                      </span>
                    </li>
                    <li className="flex items-center gap-4">
                      <UploadCloud className="text-primary h-6 w-6" />
                      <div className="flex-grow">
                        <p className="font-semibold">
                          Upload additional documents
                        </p>
                        <p className="text-muted-foreground text-sm">
                          We need a few more details
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        Today
                      </span>
                    </li>
                    <li className="flex items-center gap-4">
                      <CreditCard className="text-primary h-6 w-6" />
                      <div className="flex-grow">
                        <p className="font-semibold">Set up a payment method</p>
                        <p className="text-muted-foreground text-sm">
                          Avoid delaying invoices and payments
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        Yesterday
                      </span>
                    </li>
                    <li className="flex items-center gap-4">
                      <CheckCheck className="text-primary h-6 w-6" />
                      <div className="flex-grow">
                        <p className="font-semibold">Finish verification</p>
                        <p className="text-muted-foreground text-sm">
                          Verify your account securely
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        Yesterday
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Upcoming events</CardTitle>
                  <Button variant="link">View all</Button>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  <ul className="space-y-4">
                    <li className="flex items-center gap-4">
                      <Calendar className="text-destructive h-6 w-6" />
                      <div className="flex-grow">
                        <p className="font-semibold">Department Offsite</p>
                        <p className="text-muted-foreground text-sm">
                          Monday, Nov 13, 2023
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        All-day
                      </span>
                    </li>
                    <li className="flex items-center gap-4">
                      <Calendar className="text-destructive h-6 w-6" />
                      <div className="flex-grow">
                        <p className="font-semibold">Quarterly Review</p>
                        <p className="text-muted-foreground text-sm">
                          Tuesday, Nov 3, 2023
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        9:00 AM
                      </span>
                    </li>
                    <li className="flex items-center gap-4">
                      <Calendar className="text-destructive h-6 w-6" />
                      <div className="flex-grow">
                        <p className="font-semibold">Project kick-off</p>
                        <p className="text-muted-foreground text-sm">
                          Monday, Nov 13, 2023
                        </p>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        3:00 PM
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Updates</CardTitle>
                <Button variant="link">View all</Button>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-semibold">5 new members</p>
                    <p className="text-muted-foreground text-sm">
                      1 onboarding now
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                  <AlarmClock className="h-6 w-6 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-semibold">3 reminders</p>
                    <p className="text-muted-foreground text-sm">2 overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Departments</CardTitle>
                <Button variant="link">View all</Button>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  <li className="flex items-center gap-4">
                    <Wrench className="text-muted-foreground h-6 w-6" />
                    <p className="flex-grow font-semibold">Engineering</p>
                    <span className="text-muted-foreground">12</span>
                  </li>
                  <li className="flex items-center gap-4">
                    <PieChart className="text-muted-foreground h-6 w-6" />
                    <p className="flex-grow font-semibold">Product</p>
                    <span className="text-muted-foreground">5</span>
                  </li>
                  <li className="flex items-center gap-4">
                    <Brush className="text-muted-foreground h-6 w-6" />
                    <p className="flex-grow font-semibold">Design</p>
                    <span className="text-muted-foreground">3</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recently joined</CardTitle>
                <Button variant="link">View all</Button>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  <li className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://res.cloudinary.com/subframe/image/upload/v1711417507/shared/fychrij7dzl8wgq2zjq9.avif" />
                      <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <p className="flex-grow font-semibold">Abigail</p>
                    <span className="text-muted-foreground text-sm">
                      Oct 24
                    </span>
                  </li>
                  <li className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://res.cloudinary.com/subframe/image/upload/v1711417514/shared/ubsk7cs5hnnaj798efej.jpg" />
                      <AvatarFallback>J</AvatarFallback>
                    </Avatar>
                    <p className="flex-grow font-semibold">Jonah</p>
                    <span className="text-muted-foreground text-sm">Nov 5</span>
                  </li>
                  <li className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://res.cloudinary.com/subframe/image/upload/v1711417513/shared/kwut7rhuyivweg8tmyzl.jpg" />
                      <AvatarFallback>M</AvatarFallback>
                    </Avatar>
                    <p className="flex-grow font-semibold">Michael</p>
                    <span className="text-muted-foreground text-sm">
                      Nov 23
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}

export default DashboardPage;
