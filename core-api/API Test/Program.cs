using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace API_Test
{
    public class Program
    {


        public static void Main(string[] args)
        {

            BuildWebHost(args).Run();
        }
       

        public class QAFormatWrapper
        {
            public string Question { get; set; }
            public string Answer { get; set; }
        }
        public class PdfFormatWrapper
        {
            public string nameOfFile { get; set; }
            public decimal value { get; set; }
            
        }
        public static IWebHost BuildWebHost(string[] args) =>
            WebHost.CreateDefaultBuilder(args)
                .UseStartup<Startup>()
                .Build();
    }
}
