using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace StrategyEngine.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetCorrelations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AssetCorrelations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TickerA = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TickerB = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Value = table.Column<double>(type: "double precision", nullable: false),
                    CalculatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetCorrelations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AssetCorrelations_TickerA_TickerB",
                table: "AssetCorrelations",
                columns: new[] { "TickerA", "TickerB" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssetCorrelations");
        }
    }
}
