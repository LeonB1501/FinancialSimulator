using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace StrategyEngine.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMarketDataTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MarketTickers",
                columns: table => new
                {
                    Ticker = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FullName = table.Column<string>(type: "text", nullable: false),
                    HistoryJson = table.Column<string>(type: "jsonb", nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketTickers", x => x.Ticker);
                });

            migrationBuilder.CreateTable(
                name: "ModelParameters",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Ticker = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ModelType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ParamsJson = table.Column<string>(type: "jsonb", nullable: false),
                    CalibratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelParameters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModelParameters_MarketTickers_Ticker",
                        column: x => x.Ticker,
                        principalTable: "MarketTickers",
                        principalColumn: "Ticker",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ModelParameters_Ticker_ModelType",
                table: "ModelParameters",
                columns: new[] { "Ticker", "ModelType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ModelParameters");

            migrationBuilder.DropTable(
                name: "MarketTickers");
        }
    }
}
